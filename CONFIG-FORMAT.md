# Configuration Format

Make It Pop uses JSON5 format for exporting and importing configurations. JSON5 is a more human-friendly version of JSON that's easier to read and edit manually.

## Why JSON5?

- **No quotes on keys**: Write `name: "foo"` instead of `"name": "foo"`
- **Trailing commas allowed**: No more syntax errors from that last comma!
- **Comments supported**: Add notes to explain your configuration
- **Forgiving syntax**: More like JavaScript, less strict than JSON

## File Format

```javascript
{
  // Define phrase groups with their colors
  groups: [
    {
      name: "Good phrases",        // Group name (must be unique)
      lightBg: "#90ee90",          // Light mode background
      lightText: "#000000",        // Light mode text
      darkBg: "#2d5016",           // Dark mode background
      darkText: "#ffffff",         // Dark mode text
      phrases: [                   // List of phrases to highlight
        "code review",
        "unit test",
      ],
    },
  ],

  // Define which domains use which groups
  domains: [
    {
      pattern: "*.linkedin.com",   // Domain pattern (*.example.com for subdomains)
      mode: "light",               // "light" or "dark"
      groups: [                    // Reference groups by name
        "Good phrases",
      ],
    },
  ],
}
```

## Key Features

### Group Names Instead of IDs

Groups are referenced by their **name**, not by cryptic UUIDs. This makes it easy to:
- Share configurations with others
- Copy examples from documentation
- Edit by hand without errors

```javascript
// Reference groups by their readable names
domains: [
  {
    pattern: "github.com",
    mode: "dark",
    groups: ["Good phrases", "Warning phrases"]  // Easy to read!
  }
]
```

### Automatic ID Generation

When you import a configuration, IDs are automatically generated internally. You never need to:
- Create UUIDs manually
- Keep track of ID mappings
- Worry about ID conflicts

### Domain Patterns

Two types of patterns are supported:

```javascript
domains: [
  {
    pattern: "github.com",        // Exact match: only github.com
    // ...
  },
  {
    pattern: "*.linkedin.com",    // Wildcard: matches linkedin.com and all subdomains
    // ...
  }
]
```

## Editing Tips

1. **Always use quotes for color values**: `"#90ee90"` not `#90ee90`
2. **Group names are case-sensitive**: "Good phrases" ≠ "good phrases"
3. **Trailing commas are OK**: Feel free to leave them after the last item
4. **Add comments liberally**: Help your future self understand your config
5. **Test after editing**: Import to catch any syntax errors

## Example Workflow

### Exporting
1. Click "Export Configuration" in settings
2. Downloads as `makeitpop-config-YYYY-MM-DD.json5`
3. Open in any text editor

### Editing
1. Add comments to document your groups
2. Copy/paste phrase lists from colleagues
3. Adjust colors as hex values
4. Add new groups or domains

### Importing
1. Click "Import Configuration" in settings
2. Select your edited `.json5` file
3. Extension validates and loads the configuration
4. IDs are automatically generated

## Validation

The importer checks for:
- ✓ Valid JSON5 syntax
- ✓ Required fields present
- ✓ Correct color format
- ✓ Valid mode values ("light" or "dark")
- ✓ No duplicate group names
- ✓ All referenced groups exist

If validation fails, you'll see a helpful error message explaining what's wrong.

## Sharing Configurations

Share phrase lists with teammates:

```javascript
// Save as "engineering-terms.json5"
{
  groups: [
    {
      name: "Engineering Best Practices",
      lightBg: "#90ee90",
      lightText: "#000000",
      darkBg: "#2d5016",
      darkText: "#ffffff",
      phrases: [
        "code review",
        "unit test",
        "integration test",
        "documentation",
        "type safety",
      ],
    },
  ],
  domains: []  // Let users add their own domains
}
```

## Troubleshooting

### "Invalid JSON/JSON5 format"
- Check for missing commas between items
- Make sure all strings are in quotes
- Verify brackets are properly closed

### "Duplicate group name"
- Each group must have a unique name
- Names are case-sensitive

### "Domain references unknown group"
- Make sure the group name matches exactly
- Check spelling and capitalization

### "Missing color fields"
- All four color fields required: lightBg, lightText, darkBg, darkText
- Colors must be in quotes: `"#90ee90"`
