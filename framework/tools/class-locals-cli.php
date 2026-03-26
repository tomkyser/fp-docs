<?php
/**
 * WP-CLI command for extracting, validating, and cross-referencing
 * $locals data passed to theme component template parts.
 *
 * Components receive data via set_query_var('__foreignpolicy_locals__', $locals)
 * and retrieve it with \ForeignPolicy\Helpers\Templates\get_template_part_locals().
 * All 447 component files use only static string-literal keys ($locals['key'])
 * or integer-literal keys ($locals[0]), so token_get_all() achieves 100% extraction.
 *
 * EPHEMERAL TOOL: This file is NOT permanently registered in the theme.
 * It is copied into the theme by `fp-tools.cjs locals-cli setup`
 * before locals operations and removed by `fp-tools.cjs locals-cli teardown` after.
 * See the fp-docs plugin docs for lifecycle details.
 *
 * @package ForeignPolicy
 */

class Locals_CLI_Command extends WPCOM_VIP_CLI_Command {

    /**
     * Theme root directory path.
     *
     * @var string
     */
    private $theme_root;

    /**
     * Constructor. Sets theme root path.
     */
    public function __construct() {
        $this->theme_root = get_stylesheet_directory();
    }

    // -------------------------------------------------------------------------
    // Subcommand: extract
    // -------------------------------------------------------------------------

    /**
     * Extract $locals keys from one or more component files.
     *
     * Tokenizes PHP source to find every $locals['key'] and $locals[N] access,
     * then classifies each key as Required or Optional and infers the PHP type.
     * If a @locals PHPDoc block is present, its declarations take priority.
     *
     * ## OPTIONS
     *
     * <file-or-dir>
     * : Path to a PHP file or directory (absolute, or relative to theme root).
     *
     * [--format=<format>]
     * : Output format. Accepts table, json, markdown.
     * ---
     * default: table
     * options:
     *   - table
     *   - json
     *   - markdown
     * ---
     *
     * [--recursive]
     * : When targeting a directory, recurse into subdirectories.
     *
     * @subcommand extract
     * @synopsis <file-or-dir> [--format=<format>] [--recursive]
     */
    public function extract( $args, $assoc_args ) {
        $assoc_args = wp_parse_args( $assoc_args, [
            'format'    => 'table',
            'recursive' => false,
        ] );

        $target = $this->resolve_path( $args[0] );
        $files  = $this->collect_php_files( $target, $assoc_args['recursive'] );

        if ( empty( $files ) ) {
            WP_CLI::error( 'No PHP files found at: ' . $args[0] );
        }

        $all_results = [];

        foreach ( $files as $file ) {
            $relative = $this->relative_path( $file );
            $source   = file_get_contents( $file );

            if ( false === $source ) {
                WP_CLI::warning( "Could not read: {$relative}" );
                continue;
            }

            $code_keys   = $this->extract_keys_from_tokens( $source );
            $phpdoc_keys = $this->parse_locals_phpdoc( $source );
            $merged      = $this->merge_keys( $code_keys, $phpdoc_keys );

            if ( empty( $merged ) ) {
                continue;
            }

            foreach ( $merged as &$entry ) {
                $entry['file'] = $relative;
            }
            unset( $entry );

            $all_results = array_merge( $all_results, $merged );
        }

        if ( empty( $all_results ) ) {
            WP_CLI::success( 'No $locals keys found in the targeted file(s).' );
            return;
        }

        $this->render_output( $all_results, $assoc_args['format'] );
    }

    // -------------------------------------------------------------------------
    // Subcommand: validate
    // -------------------------------------------------------------------------

    /**
     * Validate @locals PHPDoc blocks against actual code usage.
     *
     * For each file, compares keys documented in a @locals block with keys
     * actually accessed in code. Reports documented-but-unused keys,
     * undocumented keys, and type mismatches.
     *
     * ## OPTIONS
     *
     * <file-or-dir>
     * : Path to a PHP file or directory (absolute, or relative to theme root).
     *
     * [--recursive]
     * : When targeting a directory, recurse into subdirectories.
     *
     * @subcommand validate
     * @synopsis <file-or-dir> [--recursive]
     */
    public function validate( $args, $assoc_args ) {
        $assoc_args = wp_parse_args( $assoc_args, [
            'recursive' => false,
        ] );

        $target = $this->resolve_path( $args[0] );
        $files  = $this->collect_php_files( $target, $assoc_args['recursive'] );

        if ( empty( $files ) ) {
            WP_CLI::error( 'No PHP files found at: ' . $args[0] );
        }

        $total_issues = 0;

        foreach ( $files as $file ) {
            $relative = $this->relative_path( $file );
            $source   = file_get_contents( $file );

            if ( false === $source ) {
                WP_CLI::warning( "Could not read: {$relative}" );
                continue;
            }

            $code_keys   = $this->extract_keys_from_tokens( $source );
            $phpdoc_keys = $this->parse_locals_phpdoc( $source );

            // No @locals block at all.
            if ( empty( $phpdoc_keys ) ) {
                if ( ! empty( $code_keys ) ) {
                    $key_names = array_column( $code_keys, 'key' );
                    WP_CLI::warning(
                        "{$relative}: No @locals block. Code accesses " . count( $key_names ) .
                        ' key(s): ' . implode( ', ', $key_names ) .
                        '. Run `wp fp-locals extract` to generate one.'
                    );
                    $total_issues++;
                }
                continue;
            }

            $code_key_map    = $this->keys_to_map( $code_keys );
            $phpdoc_key_map  = $this->keys_to_map( $phpdoc_keys );
            $file_has_issues = false;

            // Keys documented but not accessed in code.
            $doc_only = array_diff_key( $phpdoc_key_map, $code_key_map );
            if ( ! empty( $doc_only ) ) {
                WP_CLI::warning(
                    "{$relative}: Documented but unused: " .
                    implode( ', ', array_keys( $doc_only ) )
                );
                $file_has_issues = true;
            }

            // Keys accessed in code but not documented.
            $code_only = array_diff_key( $code_key_map, $phpdoc_key_map );
            if ( ! empty( $code_only ) ) {
                WP_CLI::warning(
                    "{$relative}: Undocumented: " .
                    implode( ', ', array_keys( $code_only ) )
                );
                $file_has_issues = true;
            }

            // Type mismatches (compare only keys present in both).
            $common = array_intersect_key( $phpdoc_key_map, $code_key_map );
            foreach ( $common as $key => $doc_entry ) {
                $code_type = $code_key_map[ $key ]['type'];
                $doc_type  = $doc_entry['type'];
                if ( 'mixed' !== $code_type && 'mixed' !== $doc_type && $code_type !== $doc_type ) {
                    WP_CLI::warning(
                        "{$relative}: Type mismatch for '{$key}' — @locals says '{$doc_type}', code implies '{$code_type}'"
                    );
                    $file_has_issues = true;
                }
            }

            if ( $file_has_issues ) {
                $total_issues++;
            }
        }

        if ( 0 === $total_issues ) {
            WP_CLI::success( 'All files validated with no issues.' );
        } else {
            WP_CLI::line( '' );
            WP_CLI::line( "Validation complete. {$total_issues} file(s) with issues." );
        }
    }

    // -------------------------------------------------------------------------
    // Subcommand: cross-ref
    // -------------------------------------------------------------------------

    /**
     * Cross-reference component locals against their callers.
     *
     * For each target component file, searches the entire theme for
     * get_template_part() calls that load the component, then compares
     * keys passed by callers vs keys consumed by the component.
     *
     * ## OPTIONS
     *
     * <file-or-dir>
     * : Path to a component PHP file or directory (absolute, or relative to theme root).
     *
     * [--recursive]
     * : When targeting a directory, recurse into subdirectories.
     *
     * @subcommand cross-ref
     * @synopsis <file-or-dir> [--recursive]
     */
    public function cross_ref( $args, $assoc_args ) {
        $assoc_args = wp_parse_args( $assoc_args, [
            'recursive' => false,
        ] );

        $target = $this->resolve_path( $args[0] );
        $files  = $this->collect_php_files( $target, $assoc_args['recursive'] );

        if ( empty( $files ) ) {
            WP_CLI::error( 'No PHP files found at: ' . $args[0] );
        }

        // Pre-index all PHP files in the theme for caller searching.
        $all_theme_files = $this->collect_php_files( $this->theme_root, true );

        foreach ( $files as $file ) {
            $relative = $this->relative_path( $file );
            $slug     = $this->file_to_template_slug( $file );

            if ( empty( $slug ) ) {
                WP_CLI::warning( "{$relative}: Could not determine template slug. Skipping." );
                continue;
            }

            // Extract keys consumed by this component.
            $source        = file_get_contents( $file );
            $consumed_keys = $this->extract_keys_from_tokens( $source );
            $consumed_map  = $this->keys_to_map( $consumed_keys );

            WP_CLI::line( '' );
            WP_CLI::line( "--- {$relative} (slug: {$slug}) ---" );

            if ( empty( $consumed_map ) ) {
                WP_CLI::line( '  Component does not access $locals. Skipping.' );
                continue;
            }

            WP_CLI::line( '  Consumes: ' . implode( ', ', array_keys( $consumed_map ) ) );

            // Find callers.
            $callers = $this->find_callers_for_slug( $slug, $all_theme_files );

            if ( empty( $callers ) ) {
                WP_CLI::warning( '  No callers found in theme.' );
                continue;
            }

            foreach ( $callers as $caller ) {
                $caller_relative = $this->relative_path( $caller['file'] );
                $passed_keys     = array_keys( $caller['keys'] );

                WP_CLI::line( "  Caller: {$caller_relative}:~{$caller['line']}" );

                if ( empty( $passed_keys ) ) {
                    WP_CLI::line( '    Passes: (could not extract — may use variable)' );
                    continue;
                }

                WP_CLI::line( '    Passes: ' . implode( ', ', $passed_keys ) );

                // Keys expected but never passed.
                $required_keys = [];
                foreach ( $consumed_map as $key => $info ) {
                    if ( 'Required' === $info['required'] ) {
                        $required_keys[] = $key;
                    }
                }
                $missing = array_diff( $required_keys, $passed_keys );
                if ( ! empty( $missing ) ) {
                    WP_CLI::warning( '    Missing required: ' . implode( ', ', $missing ) );
                }

                // Keys passed but never consumed.
                $consumed_names = array_keys( $consumed_map );
                $extra          = array_diff( $passed_keys, $consumed_names );
                if ( ! empty( $extra ) ) {
                    WP_CLI::warning( '    Passed but unused: ' . implode( ', ', $extra ) );
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Subcommand: coverage
    // -------------------------------------------------------------------------

    /**
     * Report @locals PHPDoc coverage across all component files.
     *
     * Scans all PHP files under the theme's components/ directory and reports
     * how many have @locals blocks vs how many are missing them, grouped by
     * component subdirectory.
     *
     * ## OPTIONS
     *
     * [--format=<format>]
     * : Output format. Accepts table, json.
     * ---
     * default: table
     * options:
     *   - table
     *   - json
     * ---
     *
     * @subcommand coverage
     * @synopsis [--format=<format>]
     */
    public function coverage( $args, $assoc_args ) {
        $assoc_args = wp_parse_args( $assoc_args, [
            'format' => 'table',
        ] );

        $components_dir = $this->theme_root . '/components';

        if ( ! is_dir( $components_dir ) ) {
            WP_CLI::error( 'Components directory not found: ' . $components_dir );
        }

        $files = $this->collect_php_files( $components_dir, true );

        if ( empty( $files ) ) {
            WP_CLI::error( 'No PHP files found in components/.' );
        }

        // Tally by directory.
        $groups = [];
        $totals = [
            'total'     => 0,
            'with_doc'  => 0,
            'uses_locals' => 0,
        ];

        foreach ( $files as $file ) {
            $relative  = $this->relative_path( $file );
            $source    = file_get_contents( $file );
            $dir_name  = $this->component_group( $file );

            if ( ! isset( $groups[ $dir_name ] ) ) {
                $groups[ $dir_name ] = [
                    'directory'    => $dir_name,
                    'total'        => 0,
                    'uses_locals'  => 0,
                    'has_phpdoc'   => 0,
                    'no_phpdoc'    => 0,
                ];
            }

            $groups[ $dir_name ]['total']++;
            $totals['total']++;

            // Does the file use $locals at all?
            $uses_locals = ( false !== strpos( $source, '$locals' ) );

            if ( $uses_locals ) {
                $groups[ $dir_name ]['uses_locals']++;
                $totals['uses_locals']++;
            }

            // Does the file have a @locals block?
            $has_phpdoc = (bool) preg_match( '/@locals\s*\{/', $source );

            if ( $has_phpdoc ) {
                $groups[ $dir_name ]['has_phpdoc']++;
                $totals['with_doc']++;
            } elseif ( $uses_locals ) {
                $groups[ $dir_name ]['no_phpdoc']++;
            }
        }

        // Sort groups alphabetically.
        ksort( $groups );

        // Add coverage percentage.
        $rows = [];
        foreach ( $groups as $dir => $data ) {
            $coverage = ( $data['uses_locals'] > 0 )
                ? round( ( $data['has_phpdoc'] / $data['uses_locals'] ) * 100, 1 )
                : 'n/a';

            $rows[] = [
                'directory'    => $data['directory'],
                'total_files'  => $data['total'],
                'uses_locals'  => $data['uses_locals'],
                'has_phpdoc'   => $data['has_phpdoc'],
                'missing'      => $data['no_phpdoc'],
                'coverage'     => is_numeric( $coverage ) ? "{$coverage}%" : $coverage,
            ];
        }

        // Summary row.
        $overall_coverage = ( $totals['uses_locals'] > 0 )
            ? round( ( $totals['with_doc'] / $totals['uses_locals'] ) * 100, 1 )
            : 0;

        if ( 'json' === $assoc_args['format'] ) {
            WP_CLI::line( json_encode( [
                'groups'  => $rows,
                'summary' => [
                    'total_files'      => $totals['total'],
                    'uses_locals'      => $totals['uses_locals'],
                    'has_phpdoc'       => $totals['with_doc'],
                    'missing_phpdoc'   => $totals['uses_locals'] - $totals['with_doc'],
                    'coverage_percent' => $overall_coverage,
                ],
            ], JSON_PRETTY_PRINT ) );
            return;
        }

        // Table output.
        WP_CLI\Utils\format_items(
            'table',
            $rows,
            [ 'directory', 'total_files', 'uses_locals', 'has_phpdoc', 'missing', 'coverage' ]
        );

        WP_CLI::line( '' );
        WP_CLI::line( sprintf(
            'Summary: %d total files, %d use $locals, %d have @locals docs, %d missing (%s%% coverage)',
            $totals['total'],
            $totals['uses_locals'],
            $totals['with_doc'],
            $totals['uses_locals'] - $totals['with_doc'],
            $overall_coverage
        ) );
    }

    // =========================================================================
    // Token-based key extraction
    // =========================================================================

    /**
     * Extract $locals keys from PHP source using token_get_all().
     *
     * Walks the token stream looking for $locals['key'] and $locals[N] patterns.
     * For each key found, determines Required/Optional status, infers the PHP type,
     * captures the default value (if ?? is used), and records the line number.
     *
     * @param string $source Raw PHP source code.
     * @return array Array of associative arrays with keys: key, required, type, default, line.
     */
    private function extract_keys_from_tokens( $source ) {
        $tokens = token_get_all( $source );
        $count  = count( $tokens );
        $found  = [];
        // Track unique keys to avoid duplicates; keep first occurrence line,
        // but upgrade Required if any access is required.
        $seen = [];

        for ( $i = 0; $i < $count; $i++ ) {
            // Look for T_VARIABLE with value '$locals'.
            if ( ! is_array( $tokens[ $i ] ) ) {
                continue;
            }

            if ( T_VARIABLE !== $tokens[ $i ][0] || '$locals' !== $tokens[ $i ][1] ) {
                continue;
            }

            $locals_line = $tokens[ $i ][2];

            // Skip whitespace after $locals.
            $j = $i + 1;
            $j = $this->skip_whitespace( $tokens, $j, $count );

            // Must be '['.
            if ( $j >= $count || '[' !== $this->token_value( $tokens[ $j ] ) ) {
                continue;
            }
            $j++;
            $j = $this->skip_whitespace( $tokens, $j, $count );

            // Key must be T_CONSTANT_ENCAPSED_STRING or T_LNUMBER.
            if ( $j >= $count || ! is_array( $tokens[ $j ] ) ) {
                continue;
            }

            $key_token = $tokens[ $j ];
            $key_name  = null;
            $key_line  = $key_token[2];

            if ( T_CONSTANT_ENCAPSED_STRING === $key_token[0] ) {
                $key_name = trim( $key_token[1], "'\"\t\n\r\0\x0B" );
            } elseif ( T_LNUMBER === $key_token[0] ) {
                $key_name = '[' . $key_token[1] . ']';
            } else {
                continue;
            }

            // Advance past ']'.
            $j++;
            $j = $this->skip_whitespace( $tokens, $j, $count );
            if ( $j < $count && ']' === $this->token_value( $tokens[ $j ] ) ) {
                $j++;
            }

            // Determine Required vs Optional.
            $required  = 'Required';
            $default   = null;

            // Check backward for isset(, !empty(, empty(.
            if ( $this->has_guard_before( $tokens, $i ) ) {
                $required = 'Optional';
            }

            // Check forward for ?? (T_COALESCE).
            $k = $this->skip_whitespace( $tokens, $j, $count );
            if ( $k < $count && is_array( $tokens[ $k ] ) && T_COALESCE === $tokens[ $k ][0] ) {
                $required = 'Optional';
                $default  = $this->extract_coalesce_default( $tokens, $k + 1, $count );
            }

            // Infer type from surrounding context.
            $type = $this->infer_type( $tokens, $i, $j, $count, $default );

            // De-duplicate: keep first occurrence, upgrade to Required if any access is required.
            if ( isset( $seen[ $key_name ] ) ) {
                $idx = $seen[ $key_name ];
                if ( 'Required' === $required && 'Optional' === $found[ $idx ]['required'] ) {
                    $found[ $idx ]['required'] = 'Required';
                }
                // If we inferred a more specific type, upgrade.
                if ( 'mixed' === $found[ $idx ]['type'] && 'mixed' !== $type ) {
                    $found[ $idx ]['type'] = $type;
                }
                continue;
            }

            $seen[ $key_name ] = count( $found );
            $found[]           = [
                'key'      => $key_name,
                'required' => $required,
                'type'     => $type,
                'default'  => $default,
                'line'     => $key_line,
            ];
        }

        return $found;
    }

    /**
     * Check backward from a $locals token for isset(), !empty(), or empty() guards.
     *
     * Scans up to 10 tokens backward (skipping whitespace) looking for these
     * function-call patterns that indicate optional usage.
     *
     * @param array $tokens Full token array.
     * @param int   $pos    Position of the $locals T_VARIABLE token.
     * @return bool True if an optional-guard was found.
     */
    private function has_guard_before( $tokens, $pos ) {
        // Walk backward up to 10 non-whitespace tokens.
        $steps = 0;
        $k     = $pos - 1;

        while ( $k >= 0 && $steps < 10 ) {
            if ( is_array( $tokens[ $k ] ) && T_WHITESPACE === $tokens[ $k ][0] ) {
                $k--;
                continue;
            }

            $steps++;

            if ( is_array( $tokens[ $k ] ) ) {
                $token_type = $tokens[ $k ][0];
                $token_val  = $tokens[ $k ][1];

                // isset, empty — these are T_ISSET, T_EMPTY in PHP.
                if ( T_ISSET === $token_type || T_EMPTY === $token_type ) {
                    return true;
                }

                // array_key_exists might appear.
                if ( T_STRING === $token_type && 'array_key_exists' === $token_val ) {
                    return true;
                }
            }

            // Check for '(' right before $locals — that could be part of isset( or empty(.
            if ( '(' === $this->token_value( $tokens[ $k ] ) ) {
                // Check one more step back for isset/empty.
                $m = $k - 1;
                while ( $m >= 0 && is_array( $tokens[ $m ] ) && T_WHITESPACE === $tokens[ $m ][0] ) {
                    $m--;
                }
                if ( $m >= 0 && is_array( $tokens[ $m ] ) ) {
                    if ( T_ISSET === $tokens[ $m ][0] || T_EMPTY === $tokens[ $m ][0] ) {
                        return true;
                    }
                }
            }

            $k--;
        }

        return false;
    }

    /**
     * Extract the right-hand-side default value after a ?? (coalesce) operator.
     *
     * Reads the next meaningful token after the ?? and returns its literal value
     * as a string representation.
     *
     * @param array $tokens Full token array.
     * @param int   $pos    Position immediately after the T_COALESCE token.
     * @param int   $count  Total token count.
     * @return string|null The default value as a string, or null if unreadable.
     */
    private function extract_coalesce_default( $tokens, $pos, $count ) {
        $j = $this->skip_whitespace( $tokens, $pos, $count );

        if ( $j >= $count ) {
            return null;
        }

        $tok = $tokens[ $j ];

        if ( is_array( $tok ) ) {
            switch ( $tok[0] ) {
                case T_CONSTANT_ENCAPSED_STRING:
                    return trim( $tok[1], "'\"\t\n\r\0\x0B" );

                case T_LNUMBER:
                case T_DNUMBER:
                    return $tok[1];

                case T_STRING:
                    // true, false, null.
                    $lower = strtolower( $tok[1] );
                    if ( in_array( $lower, [ 'true', 'false', 'null' ], true ) ) {
                        return $lower;
                    }
                    return $tok[1];

                case T_ARRAY:
                    return 'array()';

                default:
                    return null;
            }
        }

        // Literal '[' for short array syntax.
        if ( '[' === $this->token_value( $tok ) ) {
            // Check if immediately followed by ']' (empty array).
            $m = $this->skip_whitespace( $tokens, $j + 1, $count );
            if ( $m < $count && ']' === $this->token_value( $tokens[ $m ] ) ) {
                return '[]';
            }
            return 'array(...)';
        }

        return null;
    }

    /**
     * Infer the PHP type of a $locals key from surrounding code context.
     *
     * Looks for type-casting functions (intval, esc_url, etc.), cast operators,
     * and boolean comparisons to determine the most likely type.
     *
     * @param array  $tokens  Full token array.
     * @param int    $var_pos Position of the $locals T_VARIABLE token.
     * @param int    $end_pos Position after the closing ']'.
     * @param int    $count   Total token count.
     * @param string $default The default value (from ??), if any.
     * @return string Inferred type: string, int, bool, array, or mixed.
     */
    private function infer_type( $tokens, $var_pos, $end_pos, $count, $default = null ) {
        // 1. Check for wrapping function call BEFORE $locals.
        //    Pattern: function_name( $locals['key'] )
        $b = $var_pos - 1;
        while ( $b >= 0 && is_array( $tokens[ $b ] ) && T_WHITESPACE === $tokens[ $b ][0] ) {
            $b--;
        }

        // Check for '(' right before.
        if ( $b >= 0 && '(' === $this->token_value( $tokens[ $b ] ) ) {
            $b--;
            while ( $b >= 0 && is_array( $tokens[ $b ] ) && T_WHITESPACE === $tokens[ $b ][0] ) {
                $b--;
            }

            if ( $b >= 0 && is_array( $tokens[ $b ] ) && T_STRING === $tokens[ $b ][0] ) {
                $func = strtolower( $tokens[ $b ][1] );

                $string_functions = [
                    'esc_url', 'esc_attr', 'esc_html', 'sanitize_text_field',
                    'wp_kses_post', 'wp_kses', 'strval', 'trim', 'strtolower',
                    'strtoupper', 'sanitize_title', 'sanitize_key',
                ];
                if ( in_array( $func, $string_functions, true ) ) {
                    return 'string';
                }

                $int_functions = [ 'intval', 'absint' ];
                if ( in_array( $func, $int_functions, true ) ) {
                    return 'int';
                }

                $bool_functions = [ 'boolval', 'wp_validate_boolean' ];
                if ( in_array( $func, $bool_functions, true ) ) {
                    return 'bool';
                }

                if ( 'count' === $func || 'array_keys' === $func || 'array_values' === $func ) {
                    return 'array';
                }
            }
        }

        // 2. Check for type-cast before $locals: (int), (string), (bool), (array).
        $b = $var_pos - 1;
        while ( $b >= 0 && is_array( $tokens[ $b ] ) && T_WHITESPACE === $tokens[ $b ][0] ) {
            $b--;
        }
        if ( $b >= 0 && is_array( $tokens[ $b ] ) ) {
            switch ( $tokens[ $b ][0] ) {
                case T_INT_CAST:
                    return 'int';
                case T_STRING_CAST:
                    return 'string';
                case T_BOOL_CAST:
                    return 'bool';
                case T_ARRAY_CAST:
                    return 'array';
            }
        }

        // 3. Check for boolean comparison after the key access: === true, === false.
        $k = $this->skip_whitespace( $tokens, $end_pos, $count );
        if ( $k < $count && is_array( $tokens[ $k ] ) && T_IS_IDENTICAL === $tokens[ $k ][0] ) {
            $m = $this->skip_whitespace( $tokens, $k + 1, $count );
            if ( $m < $count && is_array( $tokens[ $m ] ) && T_STRING === $tokens[ $m ][0] ) {
                $val = strtolower( $tokens[ $m ][1] );
                if ( 'true' === $val || 'false' === $val ) {
                    return 'bool';
                }
            }
        }

        // 4. Infer from default value.
        if ( null !== $default ) {
            if ( in_array( $default, [ 'true', 'false' ], true ) ) {
                return 'bool';
            }
            if ( is_numeric( $default ) && false === strpos( $default, '.' ) ) {
                return 'int';
            }
            if ( in_array( $default, [ '[]', 'array()', 'array(...)' ], true ) ) {
                return 'array';
            }
            if ( 'null' !== $default && ! is_numeric( $default ) ) {
                return 'string';
            }
        }

        return 'mixed';
    }

    // =========================================================================
    // PHPDoc @locals parsing
    // =========================================================================

    /**
     * Parse @locals PHPDoc block from PHP source.
     *
     * Expects the format:
     *   @locals {
     *     key_name: type -- Required|Optional. Description. [Default: value.]
     *   }
     *
     * Also supports em-dash and en-dash separators.
     *
     * @param string $source Raw PHP source code.
     * @return array Array of associative arrays with keys: key, required, type, default, line.
     */
    private function parse_locals_phpdoc( $source ) {
        $results = [];

        // Match @locals { ... } block. Allow flexible whitespace.
        if ( ! preg_match( '/@locals\s*\{([^}]+)\}/s', $source, $matches ) ) {
            return $results;
        }

        $block = $matches[1];

        // Parse each line.
        // Format: key_name: type -- Required|Optional. Description. [Default: value.]
        // Support both em-dash, en-dash, and double-hyphen as separator.
        $lines = explode( "\n", $block );
        foreach ( $lines as $line_num => $line ) {
            $line = trim( $line );
            $line = preg_replace( '/^\*\s*/', '', $line ); // Strip leading * from PHPDoc.

            if ( empty( $line ) ) {
                continue;
            }

            // Match: key: type (em/en dash or --) Required|Optional. rest
            if ( preg_match(
                '/^(\[?\w+\]?)\s*:\s*(\S+)\s*(?:\x{2014}|\x{2013}|--)\s*(Required|Optional)\.\s*(.*)$/u',
                $line,
                $m
            ) ) {
                $key_name  = $m[1];
                $type      = $m[2];
                $required  = $m[3];
                $desc_rest = $m[4];

                // Extract default if present: [Default: value.]
                $default = null;
                if ( preg_match( '/\[Default:\s*(.+?)\]/', $desc_rest, $dm ) ) {
                    $default = trim( $dm[1], ' .' );
                }

                $results[] = [
                    'key'      => $key_name,
                    'required' => $required,
                    'type'     => $type,
                    'default'  => $default,
                    'line'     => null, // PHPDoc doesn't have a reliable source line.
                ];
            }
        }

        return $results;
    }

    // =========================================================================
    // Cross-reference helpers
    // =========================================================================

    /**
     * Derive the template slug from a component file path.
     *
     * Converts an absolute file path like /theme/components/post/excerpt-content.php
     * into the template slug 'components/post/excerpt-content'.
     *
     * @param string $file Absolute file path.
     * @return string|null Template slug, or null if the file is not under components/.
     */
    private function file_to_template_slug( $file ) {
        $relative = $this->relative_path( $file );

        // Must be under components/.
        if ( 0 !== strpos( $relative, 'components/' ) ) {
            return null;
        }

        // Strip .php extension.
        return preg_replace( '/\.php$/', '', $relative );
    }

    /**
     * Find all callers that load a given template slug via get_template_part().
     *
     * Searches for these call variants:
     *   1. \ForeignPolicy\Helpers\Templates\get_template_part('slug', 'name', $locals)
     *   2. get_template_part('slug', 'name')
     *   3. foreignpolicy_get_template_part('slug', 'name', $locals)
     *
     * For each caller, attempts to extract the $locals array literal being passed.
     *
     * @param string $slug            Template slug (e.g., 'components/post/excerpt-content').
     * @param array  $all_theme_files Array of absolute file paths to search.
     * @return array Array of caller info arrays with keys: file, line, keys.
     */
    private function find_callers_for_slug( $slug, $all_theme_files ) {
        $callers = [];

        // The slug may be split into base + name for the 2-arg form.
        $slug_variants = $this->slug_to_search_patterns( $slug );

        foreach ( $all_theme_files as $caller_file ) {
            $source = file_get_contents( $caller_file );

            if ( false === $source ) {
                continue;
            }

            // Quick string check before tokenizing.
            $has_match = false;
            foreach ( $slug_variants as $variant ) {
                if ( false !== strpos( $source, $variant['slug_string'] ) ) {
                    $has_match = true;
                    break;
                }
            }

            if ( ! $has_match ) {
                continue;
            }

            // Tokenize and search for get_template_part calls.
            $tokens     = token_get_all( $source );
            $tok_count  = count( $tokens );

            for ( $i = 0; $i < $tok_count; $i++ ) {
                if ( ! is_array( $tokens[ $i ] ) ) {
                    continue;
                }

                $token_type = $tokens[ $i ][0];
                $token_val  = $tokens[ $i ][1];

                $is_match = false;

                if ( T_STRING === $token_type ) {
                    $is_match = in_array(
                        $token_val,
                        [ 'get_template_part', 'foreignpolicy_get_template_part' ],
                        true
                    );
                } elseif (
                    ( defined( 'T_NAME_FULLY_QUALIFIED' ) && T_NAME_FULLY_QUALIFIED === $token_type )
                    || ( defined( 'T_NAME_QUALIFIED' ) && T_NAME_QUALIFIED === $token_type )
                ) {
                    $segments  = explode( '\\', $token_val );
                    $last_seg  = end( $segments );
                    $is_match  = in_array(
                        $last_seg,
                        [ 'get_template_part', 'foreignpolicy_get_template_part' ],
                        true
                    );
                }

                if ( ! $is_match ) {
                    continue;
                }

                $call_line = $tokens[ $i ][2];

                // Find the opening '('.
                $p = $this->skip_whitespace( $tokens, $i + 1, $tok_count );
                if ( $p >= $tok_count || '(' !== $this->token_value( $tokens[ $p ] ) ) {
                    continue;
                }

                // Extract function arguments.
                $call_args = $this->extract_function_args( $tokens, $p, $tok_count );

                if ( empty( $call_args ) ) {
                    continue;
                }

                // Check if first argument matches any slug variant.
                $first_arg = $this->clean_string_token( $call_args[0] ?? '' );

                $matched = false;
                foreach ( $slug_variants as $variant ) {
                    if ( $first_arg === $variant['arg1'] ) {
                        if ( null === $variant['arg2'] ) {
                            $matched = true;
                            break;
                        }
                        $second_arg = $this->clean_string_token( $call_args[1] ?? '' );
                        if ( $second_arg === $variant['arg2'] ) {
                            $matched = true;
                            break;
                        }
                    }
                }

                if ( ! $matched ) {
                    continue;
                }

                $locals_arg_idx = isset( $call_args[2] ) ? 2 : null;
                $passed_keys = [];

                if ( null !== $locals_arg_idx && isset( $call_args[ $locals_arg_idx ] ) ) {
                    $passed_keys = $this->extract_keys_from_array_literal(
                        $call_args[ $locals_arg_idx ]
                    );
                }

                $callers[] = [
                    'file' => $caller_file,
                    'line' => $call_line,
                    'keys' => $passed_keys,
                ];
            }
        }

        return $callers;
    }

    /**
     * Generate search patterns for a template slug.
     *
     * Template slugs like 'components/post/excerpt-content--date' may be loaded as:
     *   get_template_part('components/post/excerpt-content', '-date')
     *   get_template_part('components/post/excerpt-content--date')
     *
     * This generates all possible slug/name splits for matching.
     *
     * @param string $slug Template slug.
     * @return array Array of variant arrays with keys: slug_string, arg1, arg2.
     */
    private function slug_to_search_patterns( $slug ) {
        $variants = [];

        // Full slug as single argument, no name.
        $variants[] = [
            'slug_string' => $slug,
            'arg1'        => $slug,
            'arg2'        => null,
        ];

        // Try splitting on '--' (double-dash variant, common in FP components).
        if ( false !== strpos( $slug, '--' ) ) {
            $pos  = strpos( $slug, '--' );
            $base = substr( $slug, 0, $pos );
            $name = substr( $slug, $pos ); // includes the '--'.
            $variants[] = [
                'slug_string' => $base,
                'arg1'        => $base,
                'arg2'        => $name,
            ];
        }

        // Try splitting on last '-' for single-dash variant.
        $basename = basename( $slug );
        $dirpart  = dirname( $slug );

        if ( preg_match( '/^(.+?)--(.+)$/', $basename, $m ) ) {
            // Already handled above.
        } elseif ( preg_match( '/^(.+?)-([^-]+)$/', $basename, $m ) ) {
            $base = $dirpart . '/' . $m[1];
            $name = '-' . $m[2];
            $variants[] = [
                'slug_string' => $base,
                'arg1'        => $base,
                'arg2'        => $name,
            ];
        }

        return $variants;
    }

    /**
     * Extract raw function argument strings from a parenthesized argument list.
     *
     * @param array $tokens Token array.
     * @param int   $paren_pos Position of the opening '('.
     * @param int   $count Total token count.
     * @return array Array of raw argument strings.
     */
    private function extract_function_args( $tokens, $paren_pos, $count ) {
        $depth    = 0;
        $args     = [];
        $current  = '';
        $j        = $paren_pos;

        for ( ; $j < $count; $j++ ) {
            $val = $this->token_value( $tokens[ $j ] );

            if ( '(' === $val || '[' === $val ) {
                $depth++;
                if ( 1 === $depth ) {
                    continue;
                }
            }

            if ( ')' === $val || ']' === $val ) {
                $depth--;
                if ( 0 === $depth ) {
                    $trimmed = trim( $current );
                    if ( '' !== $trimmed ) {
                        $args[] = $trimmed;
                    }
                    break;
                }
            }

            if ( ',' === $val && 1 === $depth ) {
                $args[]  = trim( $current );
                $current = '';
                continue;
            }

            if ( $depth >= 1 ) {
                $current .= is_array( $tokens[ $j ] ) ? $tokens[ $j ][1] : $tokens[ $j ];
            }
        }

        return $args;
    }

    /**
     * Extract associative array keys from a raw array literal string.
     *
     * @param string $literal Raw argument text representing an array.
     * @return array Associative array of key => true.
     */
    private function extract_keys_from_array_literal( $literal ) {
        $keys = [];

        if ( preg_match_all( '/[\'"](\w+)[\'"]\s*=>/', $literal, $matches ) ) {
            foreach ( $matches[1] as $key ) {
                $keys[ $key ] = true;
            }
        }

        return $keys;
    }

    // =========================================================================
    // Path and file utilities
    // =========================================================================

    /**
     * Resolve a user-provided path to an absolute path.
     *
     * @param string $path User-provided path.
     * @return string Absolute path.
     */
    private function resolve_path( $path ) {
        if ( 0 === strpos( $path, '/' ) ) {
            return $path;
        }
        return $this->theme_root . '/' . ltrim( $path, '/' );
    }

    /**
     * Get a path relative to the theme root.
     *
     * @param string $abs_path Absolute file path.
     * @return string Path relative to theme root.
     */
    private function relative_path( $abs_path ) {
        $prefix = $this->theme_root . '/';
        if ( 0 === strpos( $abs_path, $prefix ) ) {
            return substr( $abs_path, strlen( $prefix ) );
        }
        return $abs_path;
    }

    /**
     * Get the component group (subdirectory name) for a file under components/.
     *
     * @param string $file Absolute file path.
     * @return string Group name (e.g., 'post', 'home', 'article').
     */
    private function component_group( $file ) {
        $relative = $this->relative_path( $file );
        $rest = preg_replace( '/^components\//', '', $relative );
        $parts = explode( '/', $rest );
        return ( count( $parts ) > 1 ) ? $parts[0] : '(root)';
    }

    /**
     * Collect all PHP files from a path.
     *
     * @param string $path      Absolute file or directory path.
     * @param bool   $recursive Whether to recurse into subdirectories.
     * @return array Array of absolute file paths.
     */
    private function collect_php_files( $path, $recursive = false ) {
        if ( is_file( $path ) ) {
            return [ $path ];
        }

        if ( ! is_dir( $path ) ) {
            return [];
        }

        $files = [];

        if ( $recursive ) {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator( $path, RecursiveDirectoryIterator::SKIP_DOTS ),
                RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ( $iterator as $item ) {
                if ( $item->isFile() && 'php' === $item->getExtension() ) {
                    $files[] = $item->getPathname();
                }
            }
        } else {
            $dir_items = scandir( $path );
            foreach ( $dir_items as $item ) {
                if ( '.' === $item[0] ) {
                    continue;
                }
                $full = $path . '/' . $item;
                if ( is_file( $full ) && 'php' === pathinfo( $full, PATHINFO_EXTENSION ) ) {
                    $files[] = $full;
                }
            }
        }

        sort( $files );
        return $files;
    }

    // =========================================================================
    // Token utilities
    // =========================================================================

    /**
     * Get the string value of a token (handles both array and string tokens).
     *
     * @param mixed $token A token from token_get_all().
     * @return string The token's string value.
     */
    private function token_value( $token ) {
        return is_array( $token ) ? $token[1] : $token;
    }

    /**
     * Skip whitespace tokens forward from a position.
     *
     * @param array $tokens Token array.
     * @param int   $pos    Starting position.
     * @param int   $count  Total token count.
     * @return int Position of the next non-whitespace token.
     */
    private function skip_whitespace( $tokens, $pos, $count ) {
        while ( $pos < $count && is_array( $tokens[ $pos ] ) && T_WHITESPACE === $tokens[ $pos ][0] ) {
            $pos++;
        }
        return $pos;
    }

    /**
     * Clean a string token value, removing surrounding quotes.
     *
     * @param string $val Raw token value potentially with quotes.
     * @return string Cleaned string.
     */
    private function clean_string_token( $val ) {
        return trim( $val, "'\"\t\n\r\0\x0B " );
    }

    // =========================================================================
    // Merge and output helpers
    // =========================================================================

    /**
     * Convert an array of key entries into a keyed map (key name => entry).
     *
     * @param array $entries Array of key entry arrays.
     * @return array Associative array keyed by the 'key' field.
     */
    private function keys_to_map( $entries ) {
        $map = [];
        foreach ( $entries as $entry ) {
            $map[ $entry['key'] ] = $entry;
        }
        return $map;
    }

    /**
     * Merge code-extracted keys with PHPDoc @locals keys.
     *
     * PHPDoc declarations take priority where present. Code-extracted data
     * fills in any keys not documented in the PHPDoc block.
     *
     * @param array $code_keys   Keys extracted from token analysis.
     * @param array $phpdoc_keys Keys parsed from @locals PHPDoc.
     * @return array Merged array of key entries.
     */
    private function merge_keys( $code_keys, $phpdoc_keys ) {
        if ( empty( $phpdoc_keys ) ) {
            return $code_keys;
        }

        $code_map   = $this->keys_to_map( $code_keys );
        $doc_map    = $this->keys_to_map( $phpdoc_keys );
        $merged     = [];

        foreach ( $doc_map as $key => $doc_entry ) {
            $entry = $doc_entry;
            if ( isset( $code_map[ $key ] ) && null === $entry['line'] ) {
                $entry['line'] = $code_map[ $key ]['line'];
            }
            $merged[] = $entry;
        }

        foreach ( $code_map as $key => $code_entry ) {
            if ( ! isset( $doc_map[ $key ] ) ) {
                $merged[] = $code_entry;
            }
        }

        return $merged;
    }

    /**
     * Render extraction results in the requested output format.
     *
     * @param array  $results Array of key entry arrays.
     * @param string $format  Output format: 'table', 'json', or 'markdown'.
     */
    private function render_output( $results, $format ) {
        switch ( $format ) {
            case 'json':
                WP_CLI::line( json_encode( $results, JSON_PRETTY_PRINT ) );
                break;

            case 'markdown':
                $this->render_markdown( $results );
                break;

            case 'table':
            default:
                $rows = [];
                foreach ( $results as $entry ) {
                    $rows[] = [
                        'file'     => $entry['file'],
                        'key'      => $entry['key'],
                        'required' => $entry['required'],
                        'type'     => $entry['type'],
                        'default'  => $entry['default'] ?? '',
                        'line'     => $entry['line'] ?? '',
                    ];
                }

                WP_CLI\Utils\format_items(
                    'table',
                    $rows,
                    [ 'file', 'key', 'required', 'type', 'default', 'line' ]
                );
                break;
        }
    }

    /**
     * Render extraction results as a Markdown table, grouped by file.
     *
     * @param array $results Array of key entry arrays.
     */
    private function render_markdown( $results ) {
        $by_file = [];
        foreach ( $results as $entry ) {
            $by_file[ $entry['file'] ][] = $entry;
        }

        foreach ( $by_file as $file => $entries ) {
            WP_CLI::line( "### `{$file}`" );
            WP_CLI::line( '' );
            WP_CLI::line( '| Key | Required | Type | Default | Line |' );
            WP_CLI::line( '|-----|----------|------|---------|------|' );

            foreach ( $entries as $entry ) {
                $default = $entry['default'] ?? '';
                $line    = $entry['line'] ?? '';
                WP_CLI::line( "| `{$entry['key']}` | {$entry['required']} | {$entry['type']} | {$default} | {$line} |" );
            }

            WP_CLI::line( '' );
        }
    }
}

WP_CLI::add_command( 'fp-locals', 'Locals_CLI_Command' );
