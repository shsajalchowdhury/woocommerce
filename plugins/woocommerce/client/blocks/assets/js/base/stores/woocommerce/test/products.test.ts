/**
 * External dependencies
 */
import type { ProductResponseItem } from '@woocommerce/types';

/**
 * Internal dependencies
 */
import type { ProductsStore } from '../products';

let mockRegisteredStore: {
	state: ProductsStore[ 'state' ];
} | null = null;

let mockContext: { productId?: number; variationId?: number | null } | null =
	null;

const mockProduct = {
	id: 42,
	name: 'Test Product',
} as ProductResponseItem;

const mockVariation = {
	id: 99,
	name: 'Test Variation',
} as ProductResponseItem;

jest.mock(
	'@wordpress/interactivity',
	() => ( {
		store: jest.fn( ( namespace, definition ) => {
			if ( namespace === 'woocommerce/products' ) {
				// Simulate server-hydrated state merged with client definition.
				// Getters from definition.state are preserved, and productId /
				// variationId are added as plain values (simulating
				// wp_interactivity_state hydration).
				const stateBase = {
					products: {} as Record< number, ProductResponseItem >,
					productVariations: {} as Record<
						number,
						ProductResponseItem
					>,
					productId: 0,
					variationId: null as number | null,
				};
				const descriptors = Object.getOwnPropertyDescriptors(
					definition.state
				);
				Object.defineProperties( stateBase, descriptors );

				mockRegisteredStore = {
					state: stateBase as ProductsStore[ 'state' ],
				};
				return mockRegisteredStore;
			}
			return {};
		} ),
		getContext: jest.fn( () => mockContext ),
	} ),
	{ virtual: true }
);

describe( 'woocommerce/products store – product context derived state', () => {
	beforeEach( () => {
		mockRegisteredStore = null;
		mockContext = null;

		jest.isolateModules( () => require( '../products' ) );

		// Hydrate products and variations after store is created.
		mockRegisteredStore!.state.products = { 42: mockProduct };
		mockRegisteredStore!.state.productVariations = { 99: mockVariation };
	} );

	it( 'has writable productId and variationId state', () => {
		expect( mockRegisteredStore ).not.toBeNull();

		mockRegisteredStore!.state.productId = 42;
		mockRegisteredStore!.state.variationId = 99;

		expect( mockRegisteredStore!.state.productId ).toBe( 42 );
		expect( mockRegisteredStore!.state.variationId ).toBe( 99 );
	} );

	describe( 'parentProductInContext', () => {
		it( 'returns the product when variationId is null', () => {
			mockRegisteredStore!.state.productId = 42;
			mockRegisteredStore!.state.variationId = null;

			expect( mockRegisteredStore!.state.parentProductInContext ).toBe(
				mockProduct
			);
		} );

		it( 'returns the product even when variationId is set (never a variation)', () => {
			mockRegisteredStore!.state.productId = 42;
			mockRegisteredStore!.state.variationId = 99;

			expect( mockRegisteredStore!.state.parentProductInContext ).toBe(
				mockProduct
			);
		} );

		it( 'returns null when product is not in the store', () => {
			mockRegisteredStore!.state.productId = 999;

			expect(
				mockRegisteredStore!.state.parentProductInContext
			).toBeNull();
		} );

		describe( 'fallback matrix', () => {
			it( 'uses context.productId when the per-element context defines it', () => {
				mockRegisteredStore!.state.productId = 1;
				mockContext = { productId: 42 };

				expect(
					mockRegisteredStore!.state.parentProductInContext
				).toBe( mockProduct );
			} );

			it( 'falls back to productsState.productId when context is present but does not define productId', () => {
				mockRegisteredStore!.state.productId = 42;
				mockContext = {};

				expect(
					mockRegisteredStore!.state.parentProductInContext
				).toBe( mockProduct );
			} );

			it( 'uses productsState.productId when no context is present', () => {
				mockRegisteredStore!.state.productId = 42;
				mockContext = null;

				expect(
					mockRegisteredStore!.state.parentProductInContext
				).toBe( mockProduct );
			} );

			it( 'resolves to null when neither context nor state defines productId', () => {
				mockRegisteredStore!.state.productId = 0;
				mockContext = null;

				expect(
					mockRegisteredStore!.state.parentProductInContext
				).toBeNull();
			} );
		} );
	} );

	describe( 'productVariationInContext', () => {
		it( 'returns null when variationId is null (simple product)', () => {
			mockRegisteredStore!.state.productId = 42;
			mockRegisteredStore!.state.variationId = null;

			expect(
				mockRegisteredStore!.state.productVariationInContext
			).toBeNull();
		} );

		it( 'returns null when variationId is null (variable product, no selection)', () => {
			mockRegisteredStore!.state.products[ 10 ] = {
				id: 10,
				type: 'variable',
			} as ProductResponseItem;
			mockRegisteredStore!.state.productId = 10;
			mockRegisteredStore!.state.variationId = null;

			expect(
				mockRegisteredStore!.state.productVariationInContext
			).toBeNull();
		} );

		it( 'returns the variation when variationId is set', () => {
			mockRegisteredStore!.state.productId = 42;
			mockRegisteredStore!.state.variationId = 99;

			expect( mockRegisteredStore!.state.productVariationInContext ).toBe(
				mockVariation
			);
		} );

		it( 'returns null when variation is not in the store', () => {
			mockRegisteredStore!.state.productId = 42;
			mockRegisteredStore!.state.variationId = 999;

			expect(
				mockRegisteredStore!.state.productVariationInContext
			).toBeNull();
		} );

		describe( 'fallback matrix', () => {
			it( 'uses context.variationId when the per-element context defines it', () => {
				mockContext = { productId: 42, variationId: 99 };
				mockRegisteredStore!.state.variationId = null;

				expect(
					mockRegisteredStore!.state.productVariationInContext
				).toBe( mockVariation );
			} );

			it( 'falls back to productsState.variationId when context is present but does not define variationId', () => {
				mockContext = { productId: 42 };
				mockRegisteredStore!.state.variationId = 99;

				expect(
					mockRegisteredStore!.state.productVariationInContext
				).toBe( mockVariation );
			} );

			it( 'uses productsState.variationId when no context is present', () => {
				mockContext = null;
				mockRegisteredStore!.state.variationId = 99;

				expect(
					mockRegisteredStore!.state.productVariationInContext
				).toBe( mockVariation );
			} );

			it( 'resolves to null when neither context nor state defines variationId', () => {
				mockContext = null;
				mockRegisteredStore!.state.variationId = null;

				expect(
					mockRegisteredStore!.state.productVariationInContext
				).toBeNull();
			} );
		} );
	} );

	describe( 'productInContext', () => {
		it( 'returns parentProductInContext when no variation is selected', () => {
			mockRegisteredStore!.state.productId = 42;
			mockRegisteredStore!.state.variationId = null;

			expect( mockRegisteredStore!.state.productInContext ).toBe(
				mockProduct
			);
		} );

		it( 'returns productVariationInContext when a variation is selected', () => {
			mockRegisteredStore!.state.productId = 42;
			mockRegisteredStore!.state.variationId = 99;

			expect( mockRegisteredStore!.state.productInContext ).toBe(
				mockVariation
			);
		} );

		it( 'falls back to parentProductInContext when the variation is not populated', () => {
			mockRegisteredStore!.state.productId = 42;
			mockRegisteredStore!.state.variationId = 123;

			expect( mockRegisteredStore!.state.productInContext ).toBe(
				mockProduct
			);
		} );

		it( 'returns null when neither product nor variation resolves', () => {
			mockRegisteredStore!.state.productId = 0;
			mockRegisteredStore!.state.variationId = null;

			expect( mockRegisteredStore!.state.productInContext ).toBeNull();
		} );

		it( 'honors local context over state IDs', () => {
			mockRegisteredStore!.state.productId = 1;
			mockRegisteredStore!.state.variationId = null;
			mockContext = { productId: 42, variationId: 99 };

			expect( mockRegisteredStore!.state.productInContext ).toBe(
				mockVariation
			);
		} );
	} );

	describe( 'findProduct', () => {
		it( 'returns null when no product is stored under id', () => {
			const result = mockRegisteredStore!.state.findProduct( {
				id: 999,
			} );

			expect( result ).toBeNull();
		} );

		it( 'returns the simple product when selectedAttributes is omitted', () => {
			const simpleProduct = {
				id: 1,
				type: 'simple',
			} as ProductResponseItem;
			mockRegisteredStore!.state.products[ 1 ] = simpleProduct;

			const result = mockRegisteredStore!.state.findProduct( {
				id: 1,
			} );

			expect( result ).toBe( simpleProduct );
		} );

		it( 'returns the simple product when selectedAttributes is an empty array', () => {
			const simpleProduct = {
				id: 1,
				type: 'simple',
			} as ProductResponseItem;
			mockRegisteredStore!.state.products[ 1 ] = simpleProduct;

			const result = mockRegisteredStore!.state.findProduct( {
				id: 1,
				selectedAttributes: [],
			} );

			expect( result ).toBe( simpleProduct );
		} );

		it( 'returns the non-variable product regardless of selectedAttributes value', () => {
			const groupedProduct = {
				id: 1,
				type: 'grouped',
			} as ProductResponseItem;
			mockRegisteredStore!.state.products[ 1 ] = groupedProduct;

			const result = mockRegisteredStore!.state.findProduct( {
				id: 1,
				selectedAttributes: [ { attribute: 'Color', value: 'red' } ],
			} );

			expect( result ).toBe( groupedProduct );
		} );

		it( 'returns the parent product when the product is variable and no attributes are selected', () => {
			const variableProduct = {
				id: 1,
				type: 'variable',
				variations: [
					{
						id: 10,
						attributes: [ { name: 'Color', value: 'red' } ],
					},
				],
			} as unknown as ProductResponseItem;
			mockRegisteredStore!.state.products[ 1 ] = variableProduct;

			expect( mockRegisteredStore!.state.findProduct( { id: 1 } ) ).toBe(
				variableProduct
			);
			expect(
				mockRegisteredStore!.state.findProduct( {
					id: 1,
					selectedAttributes: [],
				} )
			).toBe( variableProduct );
		} );

		it( 'returns the matched variation when selectedAttributes match and the variation is populated', () => {
			const variableProduct = {
				id: 1,
				type: 'variable',
				variations: [
					{
						id: 10,
						attributes: [ { name: 'Color', value: 'red' } ],
					},
				],
			} as unknown as ProductResponseItem;
			const populatedVariation = {
				id: 10,
				name: 'Red Variation',
			} as ProductResponseItem;
			mockRegisteredStore!.state.products[ 1 ] = variableProduct;
			mockRegisteredStore!.state.productVariations[ 10 ] =
				populatedVariation;

			const result = mockRegisteredStore!.state.findProduct( {
				id: 1,
				selectedAttributes: [ { attribute: 'Color', value: 'red' } ],
			} );

			expect( result ).toBe( populatedVariation );
		} );

		it( 'returns null when attributes match a variation but the variation is not populated', () => {
			const variableProduct = {
				id: 1,
				type: 'variable',
				variations: [
					{
						id: 10,
						attributes: [ { name: 'Color', value: 'red' } ],
					},
				],
			} as unknown as ProductResponseItem;
			mockRegisteredStore!.state.products[ 1 ] = variableProduct;
			// productVariations intentionally empty.

			const result = mockRegisteredStore!.state.findProduct( {
				id: 1,
				selectedAttributes: [ { attribute: 'Color', value: 'red' } ],
			} );

			expect( result ).toBeNull();
		} );

		it( 'returns null when attributes do not match any variation', () => {
			const variableProduct = {
				id: 1,
				type: 'variable',
				variations: [
					{
						id: 10,
						attributes: [ { name: 'Color', value: 'red' } ],
					},
				],
			} as unknown as ProductResponseItem;
			mockRegisteredStore!.state.products[ 1 ] = variableProduct;
			mockRegisteredStore!.state.productVariations[ 10 ] = {
				id: 10,
			} as ProductResponseItem;

			const result = mockRegisteredStore!.state.findProduct( {
				id: 1,
				selectedAttributes: [ { attribute: 'Color', value: 'blue' } ],
			} );

			expect( result ).toBeNull();
		} );

		describe( 'ported matching-algorithm coverage', () => {
			it( 'matches on multi-word attribute values with case-insensitive, prefix-tolerant names', () => {
				const variableProduct = {
					id: 3,
					type: 'variable',
					variations: [
						{
							id: 301,
							attributes: [
								{ name: 'Color', value: 'Blue' },
								{ name: 'numeric size', value: '42' },
							],
						},
						{
							id: 302,
							attributes: [
								{ name: 'Color', value: 'Red' },
								{ name: 'numeric size', value: '44' },
							],
						},
					],
				} as unknown as ProductResponseItem;
				const matched = {
					id: 301,
					name: 'Blue 42',
				} as ProductResponseItem;
				mockRegisteredStore!.state.products[ 3 ] = variableProduct;
				mockRegisteredStore!.state.productVariations[ 301 ] = matched;

				const result = mockRegisteredStore!.state.findProduct( {
					id: 3,
					selectedAttributes: [
						{ attribute: 'attribute_pa_color', value: 'Blue' },
						{
							attribute: 'attribute_pa_numeric-size',
							value: '42',
						},
					],
				} );

				expect( result ).toBe( matched );
			} );

			it( 'matches when Store API uses hyphens instead of spaces in the attribute name', () => {
				const variableProduct = {
					id: 4,
					type: 'variable',
					variations: [
						{
							id: 401,
							attributes: [
								{ name: 'numeric-size', value: '42' },
							],
						},
					],
				} as unknown as ProductResponseItem;
				const matched = { id: 401 } as ProductResponseItem;
				mockRegisteredStore!.state.products[ 4 ] = variableProduct;
				mockRegisteredStore!.state.productVariations[ 401 ] = matched;

				const result = mockRegisteredStore!.state.findProduct( {
					id: 4,
					selectedAttributes: [
						{
							attribute: 'attribute_pa_numeric-size',
							value: '42',
						},
					],
				} );

				expect( result ).toBe( matched );
			} );

			it( 'matches a variation whose attribute value is "Any" (null) when the selected value is not null', () => {
				const variableProduct = {
					id: 2,
					type: 'variable',
					variations: [
						{
							id: 201,
							attributes: [
								{ name: 'Color', value: null }, // "Any" color
								{ name: 'Size', value: 'Small' },
							],
						},
					],
				} as unknown as ProductResponseItem;
				const matched = { id: 201 } as ProductResponseItem;
				mockRegisteredStore!.state.products[ 2 ] = variableProduct;
				mockRegisteredStore!.state.productVariations[ 201 ] = matched;

				const result = mockRegisteredStore!.state.findProduct( {
					id: 2,
					selectedAttributes: [
						{ attribute: 'Color', value: 'Red' },
						{ attribute: 'Size', value: 'Small' },
					],
				} );

				expect( result ).toBe( matched );
			} );

			it( 'does not match an "Any" attribute when the selected value is null or the attribute is missing', () => {
				const variableProduct = {
					id: 2,
					type: 'variable',
					variations: [
						{
							id: 201,
							attributes: [
								{ name: 'Color', value: null },
								{ name: 'Size', value: 'Small' },
							],
						},
					],
				} as unknown as ProductResponseItem;
				mockRegisteredStore!.state.products[ 2 ] = variableProduct;
				mockRegisteredStore!.state.productVariations[ 201 ] = {
					id: 201,
				} as ProductResponseItem;

				expect(
					mockRegisteredStore!.state.findProduct( {
						id: 2,
						selectedAttributes: [
							{ attribute: 'Color', value: null },
							{ attribute: 'Size', value: 'Small' },
						],
					} )
				).toBeNull();

				expect(
					mockRegisteredStore!.state.findProduct( {
						id: 2,
						selectedAttributes: [
							{ attribute: 'Size', value: 'Small' },
						],
					} )
				).toBeNull();
			} );
		} );
	} );
} );
