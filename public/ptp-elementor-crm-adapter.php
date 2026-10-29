<?php
/**
 * Plugin Name: Practical Training Pathways — Elementor CRM Adapter
 * Plugin URI:  https://www.pracpathways.com.au
 * Description: Secure server-side webhook adapter connecting Elementor Pro form submissions to Practical Training Pathways CRM with HMAC-SHA256 signing, durable retry queues, and replay protection.
 * Version:     1.1.0
 * Author:      Practical Training Pathways
 * Author URI:  https://www.pracpathways.com.au
 * License:     GPL-2.0+
 */

if (!defined('ABSPATH')) {
    exit; // Prevent direct execution
}

class PTP_Elementor_CRM_Adapter {

    const OPTION_KEY = 'ptp_crm_settings';
    const QUEUE_OPTION = 'ptp_crm_retry_queue';
    const LOG_OPTION = 'ptp_crm_delivery_logs';
    const CRON_HOOK = 'ptp_crm_process_retry_queue';

    public function __construct() {
        // Hook into Elementor Pro form record creation
        add_action('elementor_pro/forms/new_record', [$this, 'handle_elementor_form'], 10, 2);

        // Register WordPress Cron action for retries
        add_action(self::CRON_HOOK, [$this, 'process_retry_queue']);

        // Admin settings page
        if (is_admin()) {
            add_action('admin_menu', [$this, 'register_admin_menu']);
            add_action('admin_init', [$this, 'register_settings']);
        }
    }

    /**
     * Intercept Elementor Pro Form Submissions
     *
     * @param \ElementorPro\Modules\Forms\Classes\Record $record
     * @param \ElementorPro\Modules\Forms\Classes\Form_Record $handler
     */
    public function handle_elementor_form($record, $handler) {
        $settings = get_option(self::OPTION_KEY, []);
        $endpoint_url = !empty($settings['endpoint_url']) ? esc_url_raw($settings['endpoint_url']) : '';
        $signing_secret = !empty($settings['signing_secret']) ? $settings['signing_secret'] : '';

        // If not configured, gracefully abort without breaking user form submission
        if (empty($endpoint_url)) {
            error_log('[PTP CRM] Form submitted but CRM endpoint URL is not configured.');
            return;
        }

        // 1. Extract Form Raw Fields
        $raw_fields = $record->get('fields');
        $form_name = $record->get_form_settings('form_name') ?: 'Elementor Form';
        $form_id = $record->get_form_settings('id') ?: 'elementor_form';

        $fields_data = [];
        if (!empty($raw_fields) && is_array($raw_fields)) {
            foreach ($raw_fields as $id => $field) {
                $fields_data[$id] = isset($field['value']) ? $field['value'] : '';
            }
        }

        // 2. Extract Context & Marketing UTMs
        $page_url = isset($_SERVER['HTTP_REFERER']) ? esc_url_raw($_SERVER['HTTP_REFERER']) : home_url();
        $query_params = [];
        $parsed_url = parse_url($page_url);
        if (!empty($parsed_url['query'])) {
            parse_str($parsed_url['query'], $query_params);
        }

        // 3. Generate Stable Persistent Event ID (Reused on Retries)
        $event_id = 'evt_wp_' . wp_generate_uuid4();

        $payload = [
            'event_id'         => $event_id,
            'form_id'          => $form_id,
            'form_name'        => $form_name,
            'page_url'         => $page_url,
            'submission_time'  => current_time('mysql', 1),
            'form_fields'      => $fields_data,
            'utm_source'       => isset($query_params['utm_source']) ? sanitize_text_field($query_params['utm_source']) : '',
            'utm_medium'       => isset($query_params['utm_medium']) ? sanitize_text_field($query_params['utm_medium']) : '',
            'utm_campaign'     => isset($query_params['utm_campaign']) ? sanitize_text_field($query_params['utm_campaign']) : '',
            'utm_term'         => isset($query_params['utm_term']) ? sanitize_text_field($query_params['utm_term']) : '',
            'utm_content'      => isset($query_params['utm_content']) ? sanitize_text_field($query_params['utm_content']) : '',
            'gclid'            => isset($query_params['gclid']) ? sanitize_text_field($query_params['gclid']) : '',
            'fbclid'           => isset($query_params['fbclid']) ? sanitize_text_field($query_params['fbclid']) : '',
            'client_ip'        => isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : '',
        ];

        // 4. Dispatch immediately
        $success = $this->dispatch_to_crm($payload, $endpoint_url, $signing_secret);

        // 5. If delivery fails (e.g. CRM timeout or network error), queue for reliable retry
        if (!$success) {
            $this->queue_for_retry($payload, 1);
        }
    }

    /**
     * Dispatch Payload to CRM with HMAC-SHA256 Signature
     */
    private function dispatch_to_crm($payload, $endpoint_url, $signing_secret) {
        $body_json = wp_json_encode($payload);
        $timestamp = time();
        $event_id  = $payload['event_id'];

        $headers = [
            'Content-Type'      => 'application/json; charset=utf-8',
            'X-PTP-Timestamp'   => (string) $timestamp,
            'X-PTP-Event-ID'    => (string) $event_id,
            'User-Agent'        => 'PTP-Elementor-CRM-Adapter/1.1.0 (WordPress)',
        ];

        // Compute HMAC-SHA256 signature if secret is available
        if (!empty($signing_secret)) {
            $signature = hash_hmac('sha256', $body_json, $signing_secret);
            $headers['X-PTP-Signature'] = 'sha256=' . $signature;
            $headers['X-Elementor-Webhook-Secret'] = $signing_secret;
        }

        $response = wp_remote_post($endpoint_url, [
            'method'      => 'POST',
            'timeout'     => 15,
            'redirection' => 3,
            'httpversion' => '1.1',
            'headers'     => $headers,
            'body'        => $body_json,
            'sslverify'   => true,
        ]);

        $status_code = wp_remote_retrieve_response_code($response);
        $is_success = ($status_code >= 200 && $status_code < 300);
        $error_msg  = is_wp_error($response) ? $response->get_error_message() : "HTTP $status_code";

        $this->log_delivery($event_id, $payload['form_name'], $is_success ? 'delivered' : 'failed', $status_code, $error_msg);

        return $is_success;
    }

    /**
     * Queue Transient Failures for Bounded Exponential Backoff
     */
    private function queue_for_retry($payload, $attempt) {
        if ($attempt > 5) {
            $this->log_delivery($payload['event_id'], $payload['form_name'], 'dead_letter', 0, 'Max retry limit (5) reached.');
            return;
        }

        $queue = get_option(self::QUEUE_OPTION, []);
        $queue[$payload['event_id']] = [
            'payload'   => $payload,
            'attempt'   => $attempt,
            'queued_at' => time(),
        ];
        update_option(self::QUEUE_OPTION, $queue, false);

        // Schedule cron check in backoff seconds: 60s, 180s, 600s, 1800s, 3600s
        $delays = [1 => 60, 2 => 180, 3 => 600, 4 => 1800, 5 => 3600];
        $delay = isset($delays[$attempt]) ? $delays[$attempt] : 3600;

        wp_schedule_single_event(time() + $delay, self::CRON_HOOK);
    }

    /**
     * Process Retry Queue via WordPress Cron
     */
    public function process_retry_queue() {
        $settings = get_option(self::OPTION_KEY, []);
        $endpoint_url = !empty($settings['endpoint_url']) ? esc_url_raw($settings['endpoint_url']) : '';
        $signing_secret = !empty($settings['signing_secret']) ? $settings['signing_secret'] : '';

        if (empty($endpoint_url)) return;

        $queue = get_option(self::QUEUE_OPTION, []);
        if (empty($queue)) return;

        foreach ($queue as $event_id => $item) {
            $payload = $item['payload'];
            $attempt = $item['attempt'];

            $success = $this->dispatch_to_crm($payload, $endpoint_url, $signing_secret);
            if ($success) {
                unset($queue[$event_id]);
            } else {
                // Advance attempt and reschedule
                $queue[$event_id]['attempt'] = $attempt + 1;
                $this->queue_for_retry($payload, $attempt + 1);
                unset($queue[$event_id]);
            }
        }

        update_option(self::QUEUE_OPTION, $queue, false);
    }

    /**
     * Safe Audit Logging without Exposing Secrets
     */
    private function log_delivery($event_id, $form_name, $status, $code, $message) {
        $logs = get_option(self::LOG_OPTION, []);
        array_unshift($logs, [
            'event_id'    => $event_id,
            'form_name'   => $form_name,
            'status'      => $status,
            'http_code'   => $code,
            'message'     => substr(sanitize_text_field($message), 0, 255),
            'timestamp'   => current_time('mysql'),
        ]);

        // Keep last 50 entries
        $logs = array_slice($logs, 0, 50);
        update_option(self::LOG_OPTION, $logs, false);
    }

    /**
     * Register WordPress Admin Menu & Settings
     */
    public function register_admin_menu() {
        add_options_page(
            'PTP CRM Webhook Settings',
            'PTP CRM Ingestion',
            'manage_options',
            'ptp-crm-settings',
            [$this, 'render_admin_page']
        );
    }

    public function register_settings() {
        register_setting('ptp_crm_group', self::OPTION_KEY);
    }

    public function render_admin_page() {
        if (!current_user_can('manage_options')) return;

        $settings = get_option(self::OPTION_KEY, [
            'endpoint_url'   => 'https://crm.pracpathways.com.au/api/integrations/elementor/leads',
            'signing_secret' => '',
        ]);
        $logs = get_option(self::LOG_OPTION, []);
        $queue = get_option(self::QUEUE_OPTION, []);
        ?>
        <div class="wrap">
            <h1>Practical Training Pathways — Elementor CRM Adapter</h1>
            <p>Reliably transmits Elementor Pro form enquiries to the Practical Training Pathways CRM with cryptographic HMAC-SHA256 signing, deduplication, and automatic retries.</p>

            <form method="post" action="options.php">
                <?php settings_fields('ptp_crm_group'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="endpoint_url">CRM Ingestion Webhook URL</label></th>
                        <td>
                            <input type="url" name="<?php echo esc_attr(self::OPTION_KEY); ?>[endpoint_url]" id="endpoint_url" value="<?php echo esc_attr($settings['endpoint_url']); ?>" class="regular-text" required />
                            <p class="description">Standard endpoint: <code>https://your-crm-domain/api/integrations/elementor/leads</code></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="signing_secret">Server-Held Signing Secret</label></th>
                        <td>
                            <input type="password" name="<?php echo esc_attr(self::OPTION_KEY); ?>[signing_secret]" id="signing_secret" value="<?php echo esc_attr($settings['signing_secret']); ?>" class="regular-text" />
                            <p class="description">Shared secret generated in CRM Business Settings &rarr; Integrations. Used to compute HMAC-SHA256 signatures.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Save CRM Integration Settings'); ?>
            </form>

            <hr/>
            <h2>Pending Retry Queue (<?php echo count($queue); ?>)</h2>
            <?php if (!empty($queue)): ?>
                <p>Failed submissions currently queued for exponential backoff retry:</p>
                <ul>
                    <?php foreach ($queue as $evt_id => $q_item): ?>
                        <li><strong><?php echo esc_html($evt_id); ?></strong> — Form: <?php echo esc_html($q_item['payload']['form_name']); ?> (Attempt #<?php echo esc_html($q_item['attempt']); ?>)</li>
                    <?php endforeach; ?>
                </ul>
            <?php else: ?>
                <p><em>No pending items in queue. All deliveries up to date.</em></p>
            <?php endif; ?>

            <hr/>
            <h2>Recent Delivery Logs</h2>
            <table class="widefat fixed striped">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Event ID</th>
                        <th>Form Name</th>
                        <th>Status</th>
                        <th>HTTP Code</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (!empty($logs)): ?>
                        <?php foreach ($logs as $log): ?>
                            <tr>
                                <td><?php echo esc_html($log['timestamp']); ?></td>
                                <td><code><?php echo esc_html($log['event_id']); ?></code></td>
                                <td><?php echo esc_html($log['form_name']); ?></td>
                                <td>
                                    <?php if ($log['status'] === 'delivered'): ?>
                                        <span style="color: green; font-weight: bold;">Delivered</span>
                                    <?php else: ?>
                                        <span style="color: red; font-weight: bold;"><?php echo esc_html($log['status']); ?></span>
                                    <?php endif; ?>
                                </td>
                                <td><?php echo esc_html($log['http_code']); ?></td>
                                <td><?php echo esc_html($log['message']); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <tr><td colspan="6">No form submissions logged yet.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }
}

// Initialize adapter
new PTP_Elementor_CRM_Adapter();
