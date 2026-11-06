<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Python used to run scripts/pdf/* (needs the packages in scripts/pdf/requirements.txt)
    'pdf_extract' => [
        'python' => env('PDF_PYTHON_BIN', 'python'),
        'timeout' => (int) env('PDF_EXTRACT_TIMEOUT', 60),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Other → ติดตามงาน PC: only these LINE groups are shown (orders, messages, VRM export line_orders).
    // Comma-separated; override with PC_TRACKING_LINE_GROUP_IDS in .env.
    'pc_tracking' => [
        'line_group_ids' => array_values(array_filter(array_map('trim', explode(',',
            (string) env('PC_TRACKING_LINE_GROUP_IDS', 'C337bd99549edaa35626a62625913b7b4')
        )))),
    ],

];
