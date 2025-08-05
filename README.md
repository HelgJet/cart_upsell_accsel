# Collection Filters Component

A modern, accessible, and feature-rich collection filtering component for Shopify stores. This component provides dynamic AJAX-based filtering with improved user experience, error handling, and state management.

## Features

### ✨ Core Features

- **AJAX Filtering**: Dynamic product filtering without page reloads
- **State Management**: Maintains filter state across browser navigation
- **Loading States**: Visual feedback during filter operations
- **Error Handling**: Graceful error handling with user-friendly messages
- **Accessibility**: Full keyboard navigation and screen reader support

### 🎨 User Experience

- **Loading Indicators**: Spinner animation during filter operations
- **Visual Feedback**: Clear indication of active filters
- **Responsive Design**: Optimized for mobile and desktop
- **Dark Mode Support**: Automatic dark mode detection
- **Reduced Motion**: Respects user's motion preferences

### 🔧 Developer Features

- **Event System**: Custom events for integration with other components
- **API Methods**: Public methods for programmatic control
- **Memory Management**: Proper cleanup and resource management
- **Error Recovery**: Automatic state recovery on errors
- **Debug Logging**: Comprehensive console logging for development

## Installation

### 1. Include the JavaScript file

```html
<script src="collection-filters.js"></script>
```

### 2. Include the CSS file

```html
<link rel="stylesheet" href="collection-filters.css" />
```

### 3. Use the component in your HTML

```html
<collection-filters data-section-id="collection-render-api">
  <div class="filter-group">
    <h3 class="filter-group-title">Color</h3>
    <label>
      <input
        type="checkbox"
        data-add-url="/collections/all?filter=color-red"
        data-remove-url="/collections/all"
        data-filter-value="red"
      />
      Red
    </label>
    <label>
      <input
        type="checkbox"
        data-add-url="/collections/all?filter=color-blue"
        data-remove-url="/collections/all"
        data-filter-value="blue"
      />
      Blue
    </label>
  </div>
</collection-filters>
```

## HTML Structure

### Required Attributes

- `data-section-id`: The section ID for AJAX requests (defaults to "collection-render-api")

### Filter Options

Each checkbox should have:

- `data-add-url`: URL to add the filter
- `data-remove-url`: URL to remove the filter
- `data-filter-value`: Unique identifier for the filter (optional, falls back to value/name)

### Example Structure

```html
<collection-filters data-section-id="collection-render-api">
  <!-- Filter Group 1: Color -->
  <div class="filter-group">
    <h3 class="filter-group-title">Color</h3>
    <label>
      <input
        type="checkbox"
        data-add-url="/collections/all?filter=color-red"
        data-remove-url="/collections/all"
        data-filter-value="red"
      />
      Red <span class="filter-count">(12)</span>
    </label>
    <label>
      <input
        type="checkbox"
        data-add-url="/collections/all?filter=color-blue"
        data-remove-url="/collections/all"
        data-filter-value="blue"
      />
      Blue <span class="filter-count">(8)</span>
    </label>
  </div>

  <!-- Filter Group 2: Size -->
  <div class="filter-group">
    <h3 class="filter-group-title">Size</h3>
    <label>
      <input
        type="checkbox"
        data-add-url="/collections/all?filter=size-small"
        data-remove-url="/collections/all"
        data-filter-value="small"
      />
      Small
    </label>
    <label>
      <input
        type="checkbox"
        data-add-url="/collections/all?filter=size-medium"
        data-remove-url="/collections/all"
        data-filter-value="medium"
      />
      Medium
    </label>
  </div>

  <!-- Clear Filters Button -->
  <button class="clear-filters-btn">Clear All Filters</button>
</collection-filters>
```

## JavaScript API

### Properties

- `isLoading`: Boolean indicating if a filter request is in progress
- `sectionId`: The section ID for AJAX requests
- `collectionContainer`: The container element for collection content

### Methods

#### `getActiveFilters()`

Returns an array of currently active filter values.

```javascript
const filters = document.querySelector("collection-filters");
const activeFilters = filters.getActiveFilters();
console.log(activeFilters); // ['red', 'small']
```

#### `clearAllFilters()`

Clears all active filters.

```javascript
const filters = document.querySelector("collection-filters");
await filters.clearAllFilters();
```

#### `applyFilters(filterValues)`

Applies specific filters programmatically.

```javascript
const filters = document.querySelector("collection-filters");
await filters.applyFilters(["red", "small"]);
```

#### `cleanup()`

Manually cleanup resources (called automatically on disconnect).

```javascript
const filters = document.querySelector("collection-filters");
filters.cleanup();
```

## Events

The component dispatches several custom events for integration:

### `filters-loading`

Fired when loading state changes.

```javascript
filters.addEventListener("filters-loading", (event) => {
  console.log("Loading:", event.detail.isLoading);
});
```

### `collection-updated`

Fired when collection content is updated.

```javascript
filters.addEventListener("collection-updated", (event) => {
  console.log("Collection updated:", event.detail.container);
});
```

### `filters-error`

Fired when a filter operation fails.

```javascript
filters.addEventListener("filters-error", (event) => {
  console.error("Filter error:", event.detail.error);
});
```

## CSS Customization

### Custom Properties

You can customize the appearance using CSS custom properties:

```css
collection-filters {
  --filter-primary-color: #007bff;
  --filter-secondary-color: #6c757d;
  --filter-border-radius: 6px;
  --filter-transition-duration: 0.2s;
}
```

### Styling Examples

#### Custom Loading Animation

```css
collection-filters.is-loading::after {
  /* Custom loading spinner */
  background: linear-gradient(45deg, #f0f0f0, #e0e0e0);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

#### Custom Filter Styles

```css
collection-filters label:has(input:checked) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transform: scale(1.02);
}
```

## Browser Support

- **Modern Browsers**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **Features Used**:
  - Custom Elements
  - Fetch API with AbortController
  - CSS Grid and Flexbox
  - CSS Custom Properties
  - Async/await

## Performance Considerations

### Optimizations

- **Request Cancellation**: Pending requests are cancelled when new ones are made
- **Debouncing**: Prevents rapid successive requests
- **Memory Management**: Proper cleanup of event listeners and timers
- **Caching**: Browser-level caching of AJAX responses

### Best Practices

1. **Minimize Filter Options**: Too many options can impact performance
2. **Optimize Server Responses**: Ensure fast response times from your server
3. **Use CDN**: Serve static assets from a CDN for better performance
4. **Monitor Network**: Use browser dev tools to monitor network requests

## Troubleshooting

### Common Issues

#### Filters not working

- Check that `data-add-url` and `data-remove-url` are correctly set
- Verify the collection container exists (`.collection-inner` or `[data-collection-container]`)
- Check browser console for JavaScript errors

#### Loading state stuck

- Check network connectivity
- Verify server is responding correctly
- Check for JavaScript errors in console

#### URL not updating

- Ensure `section_id` parameter is being removed from history URL
- Check that `window.history.pushState` is supported

### Debug Mode

Enable debug logging by setting:

```javascript
localStorage.setItem("collection-filters-debug", "true");
```

## Migration from Old Version

### Breaking Changes

1. **Event Handling**: Event listeners are now properly bound in constructor
2. **Error Handling**: Errors are now caught and handled gracefully
3. **State Management**: Internal state is now properly managed

### Migration Steps

1. Update your HTML to include the new CSS file
2. Ensure all filter options have the required `data-` attributes
3. Update any custom event listeners to use the new event names
4. Test thoroughly in your environment

## Contributing

### Development Setup

1. Clone the repository
2. Make your changes
3. Test in multiple browsers
4. Ensure accessibility compliance
5. Submit a pull request

### Code Style

- Use ES6+ features
- Follow JSDoc conventions for documentation
- Maintain accessibility standards
- Include error handling for all async operations

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Check the troubleshooting section above
- Review browser console for error messages
- Test in different browsers and devices
- Ensure your server is properly configured for AJAX requests
