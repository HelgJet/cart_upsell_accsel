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
      if (this.initInProgress) return;
      this.initInProgress = true;

      try {
        const product = await this.fetchProduct();
        if (!product) {
          this.hidden = true;
          return;
        }

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
        const cart = await this.fetchCart();
        if (!cart.items || cart.items.length === 0) return null;

        const productId = cart.items[0].product_id;
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

        const recommendationsUrl = `${window.Shopify.routes.root}recommendations/products.json?product_id=${productId}&limit=4&intent=related`;
        const res = await fetch(recommendationsUrl);

        if (res.ok) {
          const data = await res.json();
          if (data.products && data.products.length > 0) {
            const availableProducts = data.products.filter(
              (recommendedProduct) => {
                return !cart.items.some(
                  (cartItem) => cartItem.handle === recommendedProduct.handle
                );
              }
            );

            if (availableProducts.length > 0) {
              const recommendedProduct = availableProducts[0];
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
      return null;
    }

    async fetchCart() {
      try {
        const cacheKey = "upsell_cart_cache";
        const cachedData = sessionStorage.getItem(cacheKey);
        const cacheTime = sessionStorage.getItem(`${cacheKey}_time`);

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
          sessionStorage.setItem(cacheKey, JSON.stringify(cartData));
          sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());
          return cartData;
        }
      } catch (error) {
        console.warn("[cart-upsell] Cart fetch failed:", error);
      }
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
      const drawer = document.querySelector("cart-drawer");
      if (!variantId) return;

      btn.disabled = true;
      btn.innerHTML = "Adding...";

      fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: variantId, quantity: qty }],
          sections: drawer?.getSectionsToRender?.()?.map((s) => s.id),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          drawer?.renderContents?.(data);
          btn.innerHTML = "Added";

          // Immediately update upsell after successful add
          setTimeout(() => {
            clearUpsellCache();
            this.init();
          }, 100);

          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = "Add to cart";
            document.dispatchEvent(new CustomEvent("cart:rerender"));
          }, 200);
        })
        .catch((err) => {
          console.error("Upsell add error:", err);
          btn.disabled = false;
          btn.innerHTML = "Add to cart";
        });
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

  // Utility functions
  function clearUpsellCache() {
    const keys = Object.keys(sessionStorage);
    keys.forEach((key) => {
      if (key.startsWith("upsell_")) {
        sessionStorage.removeItem(key);
      }
    });
  }

  function canMakeApiCall() {
    const now = Date.now();
    if (now - lastApiCall < API_RATE_LIMIT) return false;
    lastApiCall = now;
    return true;
  }

  // Rate limiting
  let lastApiCall = 0;
  const API_RATE_LIMIT = 2000;

  // Cart update handlers
  function handleCartRerender() {
    clearUpsellCache();
    setTimeout(() => checkAndShowUpsell(), 100);
  }

  function handleCartRemoval() {
    console.log("[cart-upsell] Cart removal detected");
    clearUpsellCache();
    setTimeout(() => checkAndShowUpsell(), 300);
    setTimeout(() => {
      console.log("[cart-upsell] Force update after removal");
      checkAndShowUpsell();
    }, 1000);
  }

  // Main functions
  async function addUpsellToCart() {
    const drawer = document.querySelector("cart-drawer");
    if (!drawer) {
      console.log("[cart-upsell] No drawer found");
      return;
    }

    const footer = drawer.querySelector(".drawer__footer");
    if (!footer) {
      console.log("[cart-upsell] No footer found in drawer");
      return;
    }

    const existingUpsell = drawer.querySelector("cart-upsell");
    if (existingUpsell) {
      console.log("[cart-upsell] Existing upsell found, updating");
      existingUpsell.init();
      return;
    }

    console.log("[cart-upsell] Adding new upsell component");
    footer.insertAdjacentHTML("beforebegin", `<cart-upsell></cart-upsell>`);
  }

  async function checkAndShowUpsell() {
    console.log("[cart-upsell] Checking cart state...");
    const cart = await fetch("/cart.js")
      .then((res) => res.json())
      .catch((error) => {
        console.warn("[cart-upsell] Cart fetch failed:", error);
        return { items: [] };
      });

    console.log("[cart-upsell] Cart items:", cart.items?.length || 0);
    window.cartHasItems = cart.items && cart.items.length > 0;

    if (cart.items && cart.items.length > 0) {
      let drawer =
        document.querySelector("cart-drawer.active") ||
        document.querySelector("cart-drawer");

      if (!drawer) {
        console.log("[cart-upsell] No drawer found, will retry later");
        setTimeout(() => checkAndShowUpsell(), 500);
        return;
      }

      const existingUpsell = drawer.querySelector("cart-upsell");
      if (!existingUpsell) {
        console.log("[cart-upsell] Adding new upsell component");
        addUpsellToCart();
      } else {
        console.log("[cart-upsell] Updating existing upsell component");
        existingUpsell.initialized = false;
        existingUpsell.init();
      }
    } else {
      console.log("[cart-upsell] No items in cart, hiding upsell");
      document.querySelectorAll("cart-drawer").forEach((drawer) => {
        const existingUpsell = drawer.querySelector("cart-upsell");
        if (existingUpsell) existingUpsell.remove();
      });
    }
  }

  // Event listeners
  document.addEventListener("cart:rerender", handleCartRerender);

  // Subscribe to cart update events from cart.js
  let cartUpdateUnsubscriber = null;
  if (window.PUB_SUB_EVENTS?.cartUpdate && window.subscribe) {
    cartUpdateUnsubscriber = window.subscribe(
      window.PUB_SUB_EVENTS.cartUpdate,
      (event) => {
        console.log("[cart-upsell] Cart update event received:", event);

        if (event.cartData?.item_count !== undefined) {
          const previousItemCount = window.previousCartItemCount || 0;
          const currentItemCount = event.cartData.item_count;

          console.log(
            `[cart-upsell] Cart items: ${previousItemCount} -> ${currentItemCount}`
          );

          if (currentItemCount < previousItemCount) {
            console.log(
              "[cart-upsell] Item count decreased - removal detected"
            );
            handleCartRemoval();
          } else if (currentItemCount > previousItemCount) {
            console.log(
              "[cart-upsell] Item count increased - addition detected"
            );
            handleCartRerender();
          } else {
            console.log("[cart-upsell] Item count unchanged - update detected");
            handleCartRerender();
          }

          window.previousCartItemCount = currentItemCount;
        } else {
          console.log("[cart-upsell] No cart data, using fallback");
          handleCartRerender();
        }
      }
    );
  } else {
    document.addEventListener("cart:updated", handleCartRerender);
    document.addEventListener("cart:refresh", handleCartRerender);
  }

  // Drawer observer
  const drawerObserver = new MutationObserver((mutations) => {
    let shouldCheckUpsell = false;

    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        const drawer = mutation.target;
        if (drawer.classList.contains("active")) {
          console.log("[cart-upsell] Drawer opened, checking for upsell");
          shouldCheckUpsell = true;
        } else {
          console.log("[cart-upsell] Drawer closed, checking cart state");
          shouldCheckUpsell = true;
        }
      }

      if (mutation.type === "childList") {
        const target = mutation.target;
        if (
          target &&
          (target.classList?.contains("drawer__inner") ||
            target.classList?.contains("cart-drawer-items") ||
            target.querySelector?.(".cart-item"))
        ) {
          console.log("[cart-upsell] Drawer content changed, checking upsell");
          shouldCheckUpsell = true;
        }
      }
    });

    if (shouldCheckUpsell) {
      setTimeout(() => checkAndShowUpsell(), 100);
    }
  });

  // Initialize observers
  document.addEventListener("DOMContentLoaded", () => {
    const drawers = document.querySelectorAll("cart-drawer");
    drawers.forEach((drawer) => {
      drawerObserver.observe(drawer, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true,
      });

      const inner = drawer.querySelector(".drawer__inner");
      if (inner) {
        drawerObserver.observe(inner, {
          childList: true,
          subtree: true,
        });
      }
    });
  });

  // Initial setup
  const helpers = window.varify?.helpers || {
    onDomLoaded: (callback) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback);
      } else {
        callback();
      }
    },
  };

  helpers.onDomLoaded(() => {
    console.log("[cart-upsell] DOM loaded, initializing...");

    setTimeout(() => {
      if (!canMakeApiCall()) return;

      fetch("/cart.js")
        .then((res) => res.json())
        .then((cart) => {
          console.log(
            "[cart-upsell] Cart on load:",
            cart.items?.length || 0,
            "items"
          );
          window.previousCartItemCount = cart.items?.length || 0;

          if (cart.items && cart.items.length > 0) {
            window.cartHasItems = true;
            console.log("[cart-upsell] Cart has items, adding upsell to DOM");
            addUpsellToCart();
          }
        })
        .catch((error) => {
          console.warn("[cart-upsell] Cart check failed on load:", error);
        });
    }, 1000);
  });

  // Cleanup function
  window.cartUpsellCleanup = () => {
    if (drawerObserver) drawerObserver.disconnect();
    if (
      cartUpdateUnsubscriber &&
      typeof cartUpdateUnsubscriber === "function"
    ) {
      cartUpdateUnsubscriber();
    }
    document.removeEventListener("cart:rerender", handleCartRerender);
    document.removeEventListener("cart:updated", handleCartRerender);
    document.removeEventListener("cart:refresh", handleCartRerender);

    if (window.varify?.helpers?.resetListeners) {
      window.varify.helpers.resetListeners();
    }
  };
})();
