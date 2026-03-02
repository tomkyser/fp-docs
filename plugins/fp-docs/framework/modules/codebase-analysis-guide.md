# Codebase Analysis Guide

Guidance for how engines should analyze FP source code. Loaded on-demand when engines need to scan source files.

## PHP File Scanning Patterns

### Function/Method Extraction

```
# Find all public functions in a helper file
Grep pattern: `^function\s+\w+\(` in helpers/*.php

# Find all public methods in a class
Grep pattern: `public\s+function\s+\w+\(` in inc/**/*.php

# Find protected methods (for abstract classes)
Grep pattern: `protected\s+function\s+\w+\(` in inc/abstract/*.php
```

### Hook Registration Detection

```
# Find all action registrations
Grep pattern: `add_action\s*\(` in inc/**/*.php

# Find all filter registrations
Grep pattern: `add_filter\s*\(` in inc/**/*.php

# Extract hook name, priority, callback
Pattern: add_action( '{hook_name}', [{class}, '{method}'], {priority} )
```

### Template Hierarchy Traversal

FP uses a custom template system via `\ForeignPolicy\Helpers\Templates\get_template_part()`.

```
# Find all template part calls
Grep pattern: `get_template_part\s*\(` in components/**/*.php

# Find all direct includes
Grep pattern: `(require|include)(_once)?\s*\(` in themes/foreign-policy-2017/**/*.php
```

### Namespace Discovery

```
# Find all namespace declarations
Grep pattern: `^namespace\s+ForeignPolicy\\` in helpers/*.php

# Standard pattern: ForeignPolicy\Helpers\{Feature}
# Example: ForeignPolicy\Helpers\Posts
```

### Post Type and Taxonomy Registration

```
# CPT registration
Grep pattern: `register_post_type\s*\(` in inc/post-types/*.php

# Taxonomy registration
Grep pattern: `register_taxonomy\s*\(` in inc/taxonomies/*.php
```

### REST API Route Registration

```
# Route registration
Grep pattern: `register_rest_route\s*\(` in inc/rest-api/*.php

# Standard namespace: 'fp' with versions 'v1', 'v2'
```

### Shortcode Registration

```
# Shortcode registration
Grep pattern: `add_shortcode\s*\(` in inc/shortcodes/*.php

# Attribute defaults
Grep pattern: `shortcode_atts\s*\(` in inc/shortcodes/*.php
```

### ACF Field Detection

```
# PHP field groups
Grep pattern: `acf_add_local_field_group\s*\(` in inc/custom-fields/*.php

# JSON field groups (synced)
Glob pattern: inc/custom-fields/**/*.json
```

## JavaScript Module Analysis

```
# Named exports
Grep pattern: `export\s+(const|function|class|default)` in assets/src/scripts/**/*.js

# Event listeners
Grep pattern: `addEventListener\s*\(|\.on\s*\(` in assets/src/scripts/**/*.js

# jQuery event binding
Grep pattern: `\$\([^)]+\)\.(click|on|bind|delegate)\s*\(` in assets/src/scripts/**/*.js
```

## Component Locals Detection

```
# Direct $locals access
Grep pattern: `\$locals\[` in components/**/*.php

# Null coalescing guard (optional key)
Grep pattern: `\$locals\[.*\]\s*\?\?` in components/**/*.php

# Bare access (required key)
Pattern: $locals['key'] without ??, isset, or empty guard
```
