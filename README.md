# Cart Upsell Component

A Shopify cart upsell component that displays recommended products to customers based on items already in their cart.

## Features

- **Smart Recommendations**: Uses Shopify's product recommendations API to suggest related products
- **Cart Integration**: Automatically detects products in cart and shows relevant upsells
- **Caching**: Implements session storage caching to improve performance
- **Responsive Design**: Mobile-friendly design that adapts to different screen sizes
- **Customizable Styling**: Easy to customize CSS classes for different themes

## Files

- `cart-upsell.js` - Main JavaScript component with cart upsell functionality
- `cart-upsell.css` - Styling for the cart upsell component

## How it works

The component:

1. Fetches the current cart contents
2. Gets product recommendations based on the first item in cart
3. Filters out products already in the cart
4. Displays the recommended product with an "Add to Cart" button
5. Handles adding the recommended product to cart

## Requirements

- Shopify store with product recommendations enabled
- Access to Shopify's cart API and product recommendations API

## Browser Support

- Modern browsers with ES6+ support
- Requires fetch API support
