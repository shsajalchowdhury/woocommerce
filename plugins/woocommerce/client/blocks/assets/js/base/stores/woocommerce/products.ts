/**
 * External dependencies
 */
import { store, getContext } from '@wordpress/interactivity';
import type { ProductResponseItem } from '@woocommerce/types';
import type { SelectedAttributes } from '@woocommerce/stores/woocommerce/cart';

/**
 * Per-element selection for the current product/variation.
 *
 * The "current" product can be set in two ways:
 * - Globally, via `wp_interactivity_state( 'woocommerce/products', [ ... ] )`
 *   (used by SingleProductTemplate — one product per page).
 * - Per-element, via `data-wp-context="woocommerce/products::{ ... }"` on a
 *   wrapper element (used by SingleProduct so each product in a loop gets
 *   its own IDs).
 *
 * When present, per-element context takes precedence over the global state.
 * See ./README.md for the full model and precedence rules.
 */
type ProductContext = {
	productId?: number;
	variationId?: number | null;
};

/**
 * The state shape for the products store.
 * This matches the server-side ProductsStore state structure.
 */
export type ProductsStoreState = {
	/**
	 * Products keyed by product ID.
	 * These are in Store API format (ProductResponseItem).
	 */
	products: Record< number, ProductResponseItem >;
	/**
	 * Product variations keyed by variation ID.
	 * These are in Store API format (ProductResponseItem).
	 */
	productVariations: Record< number, ProductResponseItem >;
	/**
	 * Look up a product by ID. When `selectedAttributes` is omitted or
	 * empty, returns the product for `id`. When `selectedAttributes` is
	 * provided and the product is variable, returns the matching variation
	 * or `null` if no variation matches. For non-variable products,
	 * `selectedAttributes` is ignored.
	 */
	findProduct: ( args: {
		id: number;
		selectedAttributes?: SelectedAttributes[] | null;
	} ) => ProductResponseItem | null;
	/**
	 * The current product ID from state or per-element context.
	 */
	productId: number;
	/**
	 * The current variation ID from state or per-element context.
	 */
	variationId: number | null;
	/**
	 * The top-level product for this page/block (e.g. the variable product
	 * "Hoodie"), never a variation. Resolves `productId` from per-element
	 * context when available, otherwise from state. Use this when a block
	 * specifically needs the parent.
	 */
	parentProductInContext: ProductResponseItem | null;
	/**
	 * The currently selected variation, or `null` when none is selected.
	 * For simple/grouped products this is always `null`. Resolves
	 * `variationId` from per-element context when available, otherwise
	 * from state. Use this when a block specifically needs the variation.
	 */
	productVariationInContext: ProductResponseItem | null;
	/**
	 * The resolved product for the current context: `productVariationInContext`
	 * when a variation is selected, otherwise `parentProductInContext`.
	 *
	 * This is the property most blocks should bind to — use
	 * `parentProductInContext` or `productVariationInContext` explicitly
	 * only when the parent/variation distinction matters.
	 *
	 * Blocks can bind directly to properties, e.g.:
	 *   state.productInContext.stock_availability.text
	 *   state.productInContext.sku
	 */
	productInContext: ProductResponseItem | null;
};

/**
 * The products store type definition.
 */
export type ProductsStore = {
	state: ProductsStoreState;
};

// Stores are locked to prevent 3PD usage until the API is stable.
const universalLock =
	'I acknowledge that using a private store means my plugin will inevitably break on the next store release.';

/**
 * Normalize attribute name by stripping the 'attribute_' or 'attribute_pa_'
 * prefix that WooCommerce adds for variation attributes, and replacing
 * hyphens with spaces so that slugs (e.g., "some-name") match labels
 * (e.g., "some name").
 */
const normalizeAttributeName = ( name: string ): string =>
	name
		.replace( /^attribute_(pa_)?/, '' )
		.replace( /-/g, ' ' )
		.toLowerCase();

const attributeNamesMatch = ( a: string, b: string ): boolean =>
	normalizeAttributeName( a ) === normalizeAttributeName( b );

/**
 * The woocommerce/products store.
 *
 * Server-hydrated cache of product and variation data in Store API format
 * (`ProductResponseItem`). PHP loaders populate `products` / `productVariations`;
 * derived getters below resolve the "current" product from either global state
 * or per-element context. These getters are mirrored in PHP
 * (see ProductsStore::register_getters) so directive bindings like
 * `state.productInContext.sku` resolve during SSR as well as on the client.
 *
 * See ./README.md for the complete model, loaders, and consumer patterns.
 */
const { state: productsState } = store< ProductsStore >(
	'woocommerce/products',
	{
		state: {
			products: {},
			productVariations: {},
			findProduct( {
				id,
				selectedAttributes,
			}: {
				id: number;
				selectedAttributes?: SelectedAttributes[] | null;
			} ): ProductResponseItem | null {
				const product = productsState.products[ id ];

				if ( ! product ) {
					return null;
				}

				if (
					product.type !== 'variable' ||
					! selectedAttributes?.length
				) {
					return product;
				}

				const matchedVariation = product.variations?.find(
					( variation ) =>
						variation.attributes.every( ( attr ) => {
							const selectedAttr = selectedAttributes.find(
								( selected ) =>
									attributeNamesMatch(
										attr.name,
										selected.attribute
									)
							);

							// A null variation attribute value matches "Any".
							if ( attr.value === null ) {
								return (
									selectedAttr !== undefined &&
									selectedAttr.value !== null
								);
							}

							return selectedAttr?.value === attr.value;
						} )
				);

				if ( ! matchedVariation ) {
					return null;
				}

				return (
					productsState.productVariations[ matchedVariation.id ] ??
					null
				);
			},

			get parentProductInContext(): ProductResponseItem | null {
				const context = getContext< ProductContext >(
					'woocommerce/products'
				);
				const productId = context?.productId ?? productsState.productId;

				if ( ! productId ) {
					return null;
				}
				return productsState.products[ productId ] ?? null;
			},

			get productVariationInContext(): ProductResponseItem | null {
				const context = getContext< ProductContext >(
					'woocommerce/products'
				);
				const variationId =
					context?.variationId ?? productsState.variationId;
				if ( ! variationId ) {
					return null;
				}
				return productsState.productVariations[ variationId ] ?? null;
			},

			get productInContext(): ProductResponseItem | null {
				return (
					productsState.productVariationInContext ||
					productsState.parentProductInContext
				);
			},
		},
	},
	{ lock: universalLock }
);
