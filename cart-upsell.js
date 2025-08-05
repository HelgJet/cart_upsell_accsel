(function () {
  class CartUpsell extends HTMLElement {
    constructor() {
      super();
      this.initialized = false;
    }

    connectedCallback() {
      if (!this.initialized) {
        this.initialized = true;
        this.init();
      }
    }

    async init() {
      // Prevent multiple simultaneous init calls
      if (this.initInProgress) {
        return;
      }
      this.initInProgress = true;

      try {
        const product = await this.fetchProduct();
        if (!product) {
          // No recommendations available or cart is empty
          this.hidden = true;
          this.initInProgress = false;
          return;
        }

        // Show upsell with recommended product
        this.hidden = false;
        this.render(product);
        this.setupAddToCart(product.variants[0].id);
      } catch (error) {
        console.error("[cart-upsell] Error:", error);
        this.hidden = true;
      } finally {
        this.initInProgress = false;
      }
    }

    async fetchProduct() {
      try {
        // Get current product ID from cart
        const cart = await this.fetchCart();

        // If cart is empty, don't show upsell
        if (!cart.items || cart.items.length === 0) {
          return null;
        }

        // Get product ID from the first item in cart
        const productId = cart.items[0].product_id;

        // Check cache first
        const cacheKey = `upsell_recommendations_${productId}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        const cacheTime = sessionStorage.getItem(`${cacheKey}_time`);

        // Use cache if it's less than 5 minutes old
        if (
          cachedData &&
          cacheTime &&
          Date.now() - parseInt(cacheTime) < 300000
        ) {
          return JSON.parse(cachedData);
        }

        // Fetch recommendations based on the product in cart
        const recommendationsUrl = `${window.Shopify.routes.root}recommendations/products.json?product_id=${productId}&limit=4&intent=related`;
        const res = await fetch(recommendationsUrl);

        if (res.ok) {
          const data = await res.json();
          if (data.products && data.products.length > 0) {
            // Filter out products that are already in cart
            const availableProducts = data.products.filter(
              (recommendedProduct) => {
                return !cart.items.some(
                  (cartItem) => cartItem.handle === recommendedProduct.handle
                );
              }
            );

            // Return the first available recommended product
            if (availableProducts.length > 0) {
              const recommendedProduct = availableProducts[0];

              // Cache the result
              sessionStorage.setItem(
                cacheKey,
                JSON.stringify(recommendedProduct)
              );
              sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());

              return recommendedProduct;
            }
          }
        }
      } catch (error) {
        console.warn("[cart-upsell] Recommendations API failed:", error);
      }

      // No recommendations available
      return null;
    }

    async fetchCart() {
      try {
        // Check cache first
        const cacheKey = "upsell_cart_cache";
        const cachedData = sessionStorage.getItem(cacheKey);
        const cacheTime = sessionStorage.getItem(`${cacheKey}_time`);

        // Use cache if it's less than 30 seconds old
        if (
          cachedData &&
          cacheTime &&
          Date.now() - parseInt(cacheTime) < 30000
        ) {
          return JSON.parse(cachedData);
        }

        const res = await fetch("/cart.js");
        if (res.ok) {
          const cartData = await res.json();

          // Cache the result
          sessionStorage.setItem(cacheKey, JSON.stringify(cartData));
          sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());

          return cartData;
        }
      } catch (error) {
        console.warn("[cart-upsell] Cart fetch failed:", error);
      }

      // Return empty cart as fallback
      return { items: [] };
    }

    render(product) {
      const price = this.formatPrice(product.variants[0].price);
      const image = product.featured_image || product.images?.[0];

      this.innerHTML = `
        <div class="cart-upsell">
          <div class="cart-upsell__product">
            <div class="cart-upsell__left">
              ${
                image
                  ? `<img src="${image}" alt="${product.title}" class="cart-upsell__image">`
                  : ""
              }
              <div class="cart-upsell__info">
                <div class="cart-upsell__name">${product.title}</div>
                <div class="cart-upsell__price">${price}</div>
              </div>
            </div>
            <button class="cart-upsell__btn">Add to cart</button>
          </div>
        </div>
      `;
    }

    setupAddToCart(variantId) {
      const button = this.querySelector(".cart-upsell__btn");
      if (!button) return;

      button.addEventListener("click", () => {
        this.addVariantToCart(button, variantId, 1);
      });
    }

    addVariantToCart(btn, variantId, qty) {
      const numericId = this.extractNumericIdFromGid(variantId);
      const drawer = document.querySelector("cart-drawer");
      if (!numericId) return;

      btn.disabled = true;
      btn.innerHTML = "Adding...";

      fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: numericId, quantity: qty }],
          sections: drawer?.getSectionsToRender?.()?.map((s) => s.id),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          drawer?.renderContents?.(data);
          btn.innerHTML = "Added";
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = "Add to cart";
            // Trigger cart rerender event after adding item
            document.dispatchEvent(new CustomEvent("cart:rerender"));
          }, 1500);
        })
        .catch((err) => {
          console.error("Upsell add error:", err);
          btn.disabled = false;
          btn.innerHTML = "Add to cart";
        });
    }

    extractNumericIdFromGid(gidOrId) {
      if (typeof gidOrId === "string" && gidOrId.startsWith("gid://")) {
        const parts = gidOrId.split("/");
        return parseInt(parts[parts.length - 1], 10);
      }
      return typeof gidOrId === "number" ? gidOrId : parseInt(gidOrId, 10);
    }

    formatPrice(price) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(price / 100);
    }
  }

  // Register the component
  if (!customElements.get("cart-upsell")) {
    customElements.define("cart-upsell", CartUpsell);
  }

  // Function to add upsell to cart
  async function addUpsellToCart() {
    const drawer = document.querySelector("cart-drawer");
    if (!drawer) {
      console.log("[cart-upsell] No drawer found");
      return;
    }

    const footer = drawer.shadowRoot
      ? drawer.shadowRoot.querySelector(".drawer__footer")
      : document.querySelector(".drawer__footer");

    if (!footer) {
      console.log("[cart-upsell] No footer found in drawer");
      return;
    }

    // Check if upsell component already exists anywhere in the drawer
    const existingUpsell = drawer.querySelector("cart-upsell");
    if (existingUpsell) {
      console.log("[cart-upsell] Existing upsell found, updating");
      // Update existing upsell component to check current cart state
      existingUpsell.init();
      return;
    }

    console.log("[cart-upsell] Adding new upsell component");
    // Add new upsell component
    const upsellHTML = `
      <cart-upsell></cart-upsell>
    `;
    footer.insertAdjacentHTML("beforebegin", upsellHTML);
  }

  // Function to check if we should show upsell (called after cart updates)
  async function checkAndShowUpsell() {
    const drawer = document.querySelector("cart-drawer.active");
    if (!drawer) {
      console.log("[cart-upsell] No active drawer found");
      return;
    }

    console.log("[cart-upsell] Checking cart state...");
    const cart = await fetch("/cart.js")
      .then((res) => res.json())
      .catch((error) => {
        console.warn("[cart-upsell] Cart fetch failed:", error);
        return { items: [] };
      });

    console.log("[cart-upsell] Cart items:", cart.items?.length || 0);

    // Update cart items flag
    window.cartHasItems = cart.items && cart.items.length > 0;

    // Show upsell if there are items in cart
    if (cart.items && cart.items.length > 0) {
      const existingUpsell = drawer.querySelector("cart-upsell");
      if (!existingUpsell) {
        console.log("[cart-upsell] Adding new upsell component");
        addUpsellToCart();
      } else {
        console.log("[cart-upsell] Updating existing upsell component");
        existingUpsell.init();
      }
    } else {
      console.log("[cart-upsell] No items in cart, hiding upsell");
    }
  }

  // Store observers for cleanup
  const observers = [];

  // Use varify helpers if available, otherwise fallback to native implementation
  const helpers = window.varify?.helpers || {
    waitFor: (selector, callback) => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const elements =
                node.matches && node.matches(selector)
                  ? [node]
                  : node.querySelectorAll
                  ? node.querySelectorAll(selector)
                  : [];
              elements.forEach(callback);
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return observer;
    },
    onDomLoaded: (callback) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback);
      } else {
        callback();
      }
    },
  };

  // Wait for cart-drawer to appear and add upsell
  const waitForObserver = helpers.waitFor("cart-drawer", (drawer) => {
    // Check if cart is active/open
    if (drawer.classList.contains("active")) {
      addUpsellToCart();
    }
  });
  if (waitForObserver) observers.push(waitForObserver);

  // Track if upsell was already added to prevent infinite loops
  let upsellAdded = false;

  // Simple approach: add upsell when cart has items
  if (window.cartHasItems) {
    addUpsellToCart();
  }

  // Rate limiting for API calls
  let lastApiCall = 0;
  const API_RATE_LIMIT = 2000; // 2 seconds between API calls

  function canMakeApiCall() {
    const now = Date.now();
    if (now - lastApiCall < API_RATE_LIMIT) {
      return false;
    }
    lastApiCall = now;
    return true;
  }

  // Function to clear cache
  function clearUpsellCache() {
    const keys = Object.keys(sessionStorage);
    keys.forEach((key) => {
      if (key.startsWith("upsell_")) {
        sessionStorage.removeItem(key);
      }
    });
  }

  // Function to handle cart rerender
  function handleCartRerender() {
    clearUpsellCache();
    setTimeout(() => {
      checkAndShowUpsell();
    }, 100);
  }

  // Listen for custom cart:rerender event
  document.addEventListener("cart:rerender", handleCartRerender);

  // Listen for Shopify cart events
  document.addEventListener("cart:updated", handleCartRerender);
  document.addEventListener("cart:refresh", handleCartRerender);

  // Listen for cart clear events
  document.addEventListener("submit", function (event) {
    const form = event.target;
    const action = form.action || "";
    const method = form.method || "GET";

    if (method === "POST" && action.includes("/cart/clear")) {
      // Clear cache and check upsell after cart clear
      setTimeout(() => {
        clearUpsellCache();
        checkAndShowUpsell();
      }, 100);
    }
  });

  // Initialize on DOM load
  helpers.onDomLoaded(() => {
    console.log("[cart-upsell] DOM loaded, initializing...");

    // Check cart state and add upsell if needed
    setTimeout(() => {
      if (!canMakeApiCall()) {
        return;
      }

      fetch("/cart.js")
        .then((res) => res.json())
        .then((cart) => {
          console.log(
            "[cart-upsell] Cart on load:",
            cart.items?.length || 0,
            "items"
          );
          if (cart.items && cart.items.length > 0) {
            // Mark that we have items in cart
            window.cartHasItems = true;
            console.log("[cart-upsell] Cart has items, adding upsell to DOM");

            // Add upsell to DOM immediately
            addUpsellToCart();
          }
        })
        .catch((error) => {
          console.warn("[cart-upsell] Cart check failed on load:", error);
        });
    }, 1000);
  });

  // Cleanup function to reset all observers
  window.cartUpsellCleanup = () => {
    observers.forEach((observer) => {
      if (observer && typeof observer.disconnect === "function") {
        observer.disconnect();
      }
    });
    observers.length = 0;

    // Remove event listeners
    document.removeEventListener("cart:rerender", handleCartRerender);
    document.removeEventListener("cart:updated", handleCartRerender);
    document.removeEventListener("cart:refresh", handleCartRerender);

    // Reset flags
    upsellAdded = false;

    // Also use varify helpers cleanup if available
    if (window.varify?.helpers?.resetListeners) {
      window.varify.helpers.resetListeners();
    }
  };
})();
