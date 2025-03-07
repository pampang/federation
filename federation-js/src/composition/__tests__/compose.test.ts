import {
  GraphQLObjectType,
  isSpecifiedDirective,
  GraphQLDirective,
} from 'graphql';
import { composeServices } from '../compose';
import {
  astSerializer,
  typeSerializer,
  selectionSetSerializer,
  graphqlErrorSerializer,
  gql,
} from 'apollo-federation-integration-testsuite';
import { normalizeTypeDefs } from '../normalize';
import {
  assertCompositionFailure,
  assertCompositionSuccess,
  getFederationMetadata,
} from '../utils';

expect.addSnapshotSerializer(astSerializer);
expect.addSnapshotSerializer(typeSerializer);
expect.addSnapshotSerializer(selectionSetSerializer);
expect.addSnapshotSerializer(graphqlErrorSerializer);

describe('composeServices', () => {
  it('should include types from different services', () => {
    const serviceA = {
      typeDefs: gql`
        type Product {
          sku: String!
          name: String!
        }
      `,
      name: 'serviceA',
    };

    const serviceB = {
      typeDefs: gql`
        type User {
          name: String
          email: String!
        }
      `,
      name: 'serviceB',
    };

    const compositionResult = composeServices([serviceA, serviceB]);

    assertCompositionSuccess(compositionResult);
    const { schema } = compositionResult;
    expect(schema).toBeDefined();

    expect(schema.getType('User')).toMatchInlineSnapshot(`
      type User {
        email: String!
        name: String
      }
    `);

    expect(schema.getType('Product')).toMatchInlineSnapshot(`
      type Product {
        name: String!
        sku: String!
      }
    `);

    const product = schema.getType('Product') as GraphQLObjectType;
    const user = schema.getType('User') as GraphQLObjectType;

    expect(getFederationMetadata(product)?.serviceName).toEqual('serviceA');
    expect(getFederationMetadata(user)?.serviceName).toEqual('serviceB');
  });

  it("doesn't leave federation directives in the final schema", () => {
    const serviceA = {
      typeDefs: gql`
        type Product {
          sku: String!
          name: String!
        }
      `,
      name: 'serviceA',
    };

    const { schema } = composeServices([serviceA]);

    const directives = schema.getDirectives();
    expect(directives.every(isSpecifiedDirective));
  });

  describe('basic type extensions', () => {
    it('works when extension service is second', () => {
      const serviceA = {
        typeDefs: gql`
          type Product {
            sku: String!
            name: String!
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          extend type Product {
            price: Int!
          }
        `,
        name: 'serviceB',
      };

      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;
      expect(schema).toBeDefined();

      expect(schema.getType('Product')).toMatchInlineSnapshot(`
        type Product {
          name: String!
          price: Int!
          sku: String!
        }
      `);

      const product = schema.getType('Product') as GraphQLObjectType;

      expect(getFederationMetadata(product)?.serviceName).toEqual('serviceA');
      expect(
        getFederationMetadata(product.getFields()['price'])?.serviceName,
      ).toEqual('serviceB');
    });

    it('works when extension service is first', () => {
      const serviceA = {
        typeDefs: gql`
          extend type Product {
            price: Int!
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          type Product {
            sku: String!
            name: String!
          }
        `,
        name: 'serviceB',
      };
      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;
      expect(schema).toBeDefined();

      expect(schema.getType('Product')).toMatchInlineSnapshot(`
        type Product {
          name: String!
          price: Int!
          sku: String!
        }
      `);

      const product = schema.getType('Product') as GraphQLObjectType;

      expect(getFederationMetadata(product)?.serviceName).toEqual('serviceB');
      expect(
        getFederationMetadata(product.getFields()['price'])?.serviceName,
      ).toEqual('serviceA');
    });

    it('works with multiple extensions on the same type', () => {
      const serviceA = {
        typeDefs: gql`
          extend type Product {
            price: Int!
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          type Product {
            sku: String!
            name: String!
          }
        `,
        name: 'serviceB',
      };

      const serviceC = {
        typeDefs: gql`
          extend type Product {
            color: String!
          }
        `,
        name: 'serviceC',
      };

      const compositionResult = composeServices([serviceA, serviceB, serviceC]);
      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;
      expect(schema).toBeDefined();

      expect(schema.getType('Product')).toMatchInlineSnapshot(`
        type Product {
          color: String!
          name: String!
          price: Int!
          sku: String!
        }
      `);

      const product = schema.getType('Product') as GraphQLObjectType;

      expect(getFederationMetadata(product)?.serviceName).toEqual('serviceB');
      expect(
        getFederationMetadata(product.getFields()['price'])?.serviceName,
      ).toEqual('serviceA');
      expect(
        getFederationMetadata(product.getFields()['color'])?.serviceName,
      ).toEqual('serviceC');
    });

    it('allows extensions to overwrite other extension fields', () => {
      const serviceA = {
        typeDefs: gql`
          extend type Product {
            price: Int!
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          type Product {
            sku: String!
            name: String!
          }
        `,
        name: 'serviceB',
      };

      const serviceC = {
        typeDefs: gql`
          extend type Product {
            price: Float!
            color: String!
          }
        `,
        name: 'serviceC',
      };

      const compositionResult = composeServices([serviceA, serviceB, serviceC]);
      assertCompositionFailure(compositionResult);
      const { errors, schema } = compositionResult;
      expect(errors).toMatchInlineSnapshot(`
        Array [
          Object {
            "code": "MISSING_ERROR",
            "locations": Array [
              Object {
                "column": 3,
                "line": 3,
              },
              Object {
                "column": 3,
                "line": 3,
              },
            ],
            "message": "Field \\"Product.price\\" can only be defined once.",
          },
        ]
      `);
      expect(schema).toBeDefined();

      const product = schema.getType('Product') as GraphQLObjectType;
      expect(product).toMatchInlineSnapshot(`
        type Product {
          color: String!
          name: String!
          price: Float!
          sku: String!
        }
      `);

      expect(getFederationMetadata(product)?.serviceName).toEqual('serviceB');
      expect(
        getFederationMetadata(product.getFields()['price'])?.serviceName,
      ).toEqual('serviceC');
    });

    it('preserves arguments for fields', () => {
      const serviceA = {
        typeDefs: gql`
          enum Curr {
            USD
            GBP
          }

          extend type Product {
            price(currency: Curr!): Int!
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          type Product {
            sku: String!
            name(type: String): String!
          }
        `,
        name: 'serviceB',
      };
      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;
      expect(schema).toBeDefined();

      expect(schema.getType('Product')).toMatchInlineSnapshot(`
        type Product {
          name(type: String): String!
          price(currency: Curr!): Int!
          sku: String!
        }
      `);

      const product = schema.getType('Product') as GraphQLObjectType;
      expect(product.getFields()['price'].args[0].name).toEqual('currency');
    });

    // This is a limitation of extendSchema currently (this is currently a broken test to demonstrate)
    it.skip('overwrites field on extension by base type when base type comes second', () => {
      const serviceA = {
        typeDefs: gql`
          extend type Product {
            sku: String!
            name: String!
          }
        `,
        name: 'serviceA',
      };
      const serviceB = {
        typeDefs: gql`
          type Product {
            sku: String!
            name: String!
          }
        `,
        name: 'serviceB',
      };

      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionFailure(compositionResult);
      const { errors, schema } = compositionResult;
      expect(schema).toBeDefined();
      expect(errors).toMatchInlineSnapshot(`
                        Array [
                          [GraphQLError: Field "Product.sku" already exists in the schema. It cannot also be defined in this type extension.],
                          [GraphQLError: Field "Product.name" already exists in the schema. It cannot also be defined in this type extension.],
                        ]
                  `);

      const product = schema.getType('Product') as GraphQLObjectType;

      expect(product).toMatchInlineSnapshot(`
                        type Product {
                          sku: String!
                          name: String!
                        }
                  `);
      expect(
        getFederationMetadata(product.getFields()['sku'])?.serviceName,
      ).toEqual('serviceB');
      expect(
        getFederationMetadata(product.getFields()['name'])?.serviceName,
      ).toEqual('serviceB');
    });

    describe('collisions & error handling', () => {
      it('handles collisions on type extensions as expected', () => {
        const serviceA = {
          typeDefs: gql`
            type Product {
              sku: String!
              name: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            extend type Product {
              name: String!
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionFailure(compositionResult);
        const { errors, schema } = compositionResult;
        expect(schema).toBeDefined();
        expect(errors).toMatchInlineSnapshot(`
          Array [
            Object {
              "code": "MISSING_ERROR",
              "locations": Array [
                Object {
                  "column": 3,
                  "line": 4,
                },
              ],
              "message": "[serviceB] Product.name -> Field \\"Product.name\\" already exists in the schema. It cannot also be defined in this type extension. If this is meant to be an external field, add the \`@external\` directive.",
            },
          ]
        `);

        const product = schema.getType('Product') as GraphQLObjectType;

        expect(product).toMatchInlineSnapshot(`
          type Product {
            name: String!
            sku: String!
          }
        `);
        expect(
          getFederationMetadata(product.getFields()['name'])?.serviceName,
        ).toEqual('serviceB');
      });

      it('reports multiple errors correctly', () => {
        const serviceA = {
          typeDefs: gql`
            type Query {
              product: Product
            }

            type Product {
              sku: String!
              name: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            extend type Product {
              sku: String!
              name: String!
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionFailure(compositionResult);
        const { errors, schema } = compositionResult;
        expect(schema).toBeDefined();
        expect(errors).toMatchInlineSnapshot(`
          Array [
            Object {
              "code": "MISSING_ERROR",
              "locations": Array [
                Object {
                  "column": 3,
                  "line": 7,
                },
              ],
              "message": "[serviceB] Product.sku -> Field \\"Product.sku\\" already exists in the schema. It cannot also be defined in this type extension. If this is meant to be an external field, add the \`@external\` directive.",
            },
            Object {
              "code": "MISSING_ERROR",
              "locations": Array [
                Object {
                  "column": 3,
                  "line": 8,
                },
              ],
              "message": "[serviceB] Product.name -> Field \\"Product.name\\" already exists in the schema. It cannot also be defined in this type extension. If this is meant to be an external field, add the \`@external\` directive.",
            },
          ]
        `);

        const product = schema.getType('Product') as GraphQLObjectType;

        expect(product).toMatchInlineSnapshot(`
          type Product {
            name: String!
            sku: String!
          }
        `);
        expect(
          getFederationMetadata(product.getFields()['name'])?.serviceName,
        ).toEqual('serviceB');
      });

      it('handles collisions of base types as expected (newest takes precedence)', () => {
        const serviceA = {
          typeDefs: gql`
            type Product {
              sku: String!
              name: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            type Product {
              id: ID!
              name: String!
              price: Int!
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionFailure(compositionResult);
        const { errors, schema } = compositionResult;
        expect(schema).toBeDefined();
        expect(errors).toMatchInlineSnapshot(`
          Array [
            Object {
              "code": "MISSING_ERROR",
              "locations": Array [
                Object {
                  "column": 3,
                  "line": 4,
                },
                Object {
                  "column": 3,
                  "line": 4,
                },
              ],
              "message": "Field \\"Product.name\\" can only be defined once.",
            },
            Object {
              "code": "MISSING_ERROR",
              "locations": Array [
                Object {
                  "column": 1,
                  "line": 2,
                },
                Object {
                  "column": 6,
                  "line": 2,
                },
              ],
              "message": "There can be only one type named \\"Product\\".",
            },
          ]
        `);

        const product = schema.getType('Product') as GraphQLObjectType;

        expect(product).toMatchInlineSnapshot(`
                              type Product {
                                id: ID!
                                name: String!
                                price: Int!
                              }
                        `);
      });
    });
  });

  // Maybe just test conflicts in types
  // it("interfaces, unions", () => {});

  // TODO: _allow_ enum and input extensions, but don't add serviceName
  describe('input and enum type extensions', () => {
    it('extends input types', () => {
      const serviceA = {
        typeDefs: gql`
          input ProductInput {
            sku: String!
            name: String!
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          extend input ProductInput {
            color: String!
          }
        `,
        name: 'serviceB',
      };

      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionSuccess(compositionResult);
      expect(compositionResult.schema).toBeDefined();
    });

    it('extends enum types', () => {
      const serviceA = {
        typeDefs: gql`
          enum ProductCategory {
            BED
            BATH
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          extend enum ProductCategory {
            BEYOND
          }
        `,
        name: 'serviceB',
      };

      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionSuccess(compositionResult);
      expect(compositionResult.schema).toBeDefined();
    });
  });

  describe('interfaces', () => {
    // TODO: should there be a validation warning of some sort for this?
    it('allows overwriting a type that implements an interface improperly', () => {
      const serviceA = {
        typeDefs: gql`
          interface Item {
            id: ID!
          }

          type Product implements Item {
            id: ID!
            sku: String!
            name: String!
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          extend type Product {
            id: String!
          }
        `,
        name: 'serviceB',
      };

      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionFailure(compositionResult);
      const { errors, schema } = compositionResult;
      expect(errors).toMatchInlineSnapshot(`
        Array [
          Object {
            "code": "MISSING_ERROR",
            "locations": Array [
              Object {
                "column": 3,
                "line": 7,
              },
            ],
            "message": "[serviceB] Product.id -> Field \\"Product.id\\" already exists in the schema. It cannot also be defined in this type extension. If this is meant to be an external field, add the \`@external\` directive.",
          },
        ]
      `);
      expect(schema).toBeDefined();

      expect(schema.getType('Product')).toMatchInlineSnapshot(`
        type Product implements Item {
          id: String!
          name: String!
          sku: String!
        }
      `);

      const product = schema.getType('Product') as GraphQLObjectType;

      expect(getFederationMetadata(product)?.serviceName).toEqual('serviceA');
      expect(
        getFederationMetadata(product.getFields()['id'])?.serviceName,
      ).toEqual('serviceB');
    });
  });

  describe('root type extensions', () => {
    it('allows extension of the Query type with no base type definition', () => {
      const serviceA = {
        typeDefs: gql`
          extend type Query {
            products: [ID!]
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          extend type Query {
            people: [ID!]
          }
        `,
        name: 'serviceB',
      };

      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;
      expect(schema).toBeDefined();

      expect(schema.getQueryType()).toMatchInlineSnapshot(`
        type Query {
          people: [ID!]
          products: [ID!]
        }
      `);

      const query = schema.getQueryType()!;

      expect(getFederationMetadata(query)?.serviceName).toBeUndefined();
    });

    it('treats root Query type definition as an extension, not base definitions', () => {
      const serviceA = {
        typeDefs: gql`
          type Query {
            products: [ID!]
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          extend type Query {
            people: [ID!]
          }
        `,
        name: 'serviceB',
      };

      const normalizedServices = [serviceA, serviceB].map(
        ({ name, typeDefs }) => ({
          name,
          typeDefs: normalizeTypeDefs(typeDefs),
        }),
      );
      const compositionResult = composeServices(normalizedServices);
      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;
      expect(schema).toBeDefined();

      expect(schema.getType('Query')).toMatchInlineSnapshot(`
        type Query {
          people: [ID!]
          products: [ID!]
        }
      `);

      const query = schema.getType('Query') as GraphQLObjectType;

      expect(getFederationMetadata(query)?.serviceName).toBeUndefined();
    });

    it('allows extension of the Mutation type with no base type definition', () => {
      const serviceA = {
        typeDefs: gql`
          extend type Mutation {
            login(credentials: Credentials!): String
          }

          input Credentials {
            username: String!
            password: String!
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          extend type Mutation {
            logout(username: String!): Boolean
          }
        `,
        name: 'serviceB',
      };

      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;
      expect(schema).toBeDefined();

      expect(schema.getType('Mutation')).toMatchInlineSnapshot(`
                        type Mutation {
                          login(credentials: Credentials!): String
                          logout(username: String!): Boolean
                        }
                  `);
    });

    it('treats root Mutations type definition as an extension, not base definitions', () => {
      const serviceA = {
        typeDefs: gql`
          type Mutation {
            login(credentials: Credentials!): String
          }

          input Credentials {
            username: String!
            password: String!
          }
        `,
        name: 'serviceA',
      };

      const serviceB = {
        typeDefs: gql`
          extend type Mutation {
            logout(username: String!): Boolean
          }
        `,
        name: 'serviceB',
      };

      const compositionResult = composeServices([serviceA, serviceB]);
      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;
      expect(schema).toBeDefined();

      expect(schema.getType('Mutation')).toMatchInlineSnapshot(`
                        type Mutation {
                          login(credentials: Credentials!): String
                          logout(username: String!): Boolean
                        }
                  `);
    });

    // TODO: not sure what to do here. Haven't looked into it yet :)
    it.skip('works with custom root types', () => {});
  });

  describe('federation directives', () => {
    // Directives - allow schema (federation) directives
    describe('@external', () => {
      it('adds externals map from service to externals for @external fields', () => {
        const serviceA = {
          typeDefs: gql`
            type Product @key(fields: "color { id value }") {
              sku: String!
              upc: String!
              color: Color!
            }

            type Color {
              id: ID!
              value: String!
            }
          `,
          name: 'serviceA--FOUND',
        };

        const serviceB = {
          typeDefs: gql`
            extend type Product {
              sku: String! @external
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB--MISSING',
        };

        const serviceC = {
          typeDefs: gql`
            extend type Product {
              sku: String! @external
              upc: String! @external
              weight: Int! @requires(fields: "sku upc")
            }
          `,
          name: 'serviceC--found',
        };

        const compositionResult = composeServices([
          serviceA,
          serviceC,
          serviceB,
        ]);

        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const product = schema.getType('Product')!;

        expect(getFederationMetadata(product)?.externals)
          .toMatchInlineSnapshot(`
                              Object {
                                "serviceB--MISSING": Array [
                                  Object {
                                    "field": sku: String! @external,
                                    "parentTypeName": "Product",
                                    "serviceName": "serviceB--MISSING",
                                  },
                                ],
                                "serviceC--found": Array [
                                  Object {
                                    "field": sku: String! @external,
                                    "parentTypeName": "Product",
                                    "serviceName": "serviceC--found",
                                  },
                                  Object {
                                    "field": upc: String! @external,
                                    "parentTypeName": "Product",
                                    "serviceName": "serviceC--found",
                                  },
                                ],
                              }
                        `);
      });
      it('does not redefine fields with @external when composing', () => {
        const serviceA = {
          typeDefs: gql`
            type Product @key(fields: "sku") {
              sku: String!
              name: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            extend type Product {
              sku: String! @external
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;
        expect(schema).toBeDefined();

        const product = schema.getType('Product') as GraphQLObjectType;

        expect(product).toMatchInlineSnapshot(`
          type Product {
            name: String!
            price: Int!
            sku: String!
          }
        `);
        expect(
          getFederationMetadata(product.getFields()['price'])?.serviceName,
        ).toEqual('serviceB');
        expect(getFederationMetadata(product)?.serviceName).toEqual('serviceA');
      });
    });

    describe('@requires directive', () => {
      it('adds @requires information to fields using a simple field set', () => {
        const serviceA = {
          typeDefs: gql`
            type Product @key(fields: "sku") {
              sku: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            extend type Product {
              sku: String! @external
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const product = schema.getType('Product') as GraphQLObjectType;
        expect(
          getFederationMetadata(product.getFields()['price'])?.requires,
        ).toMatchInlineSnapshot(`sku`);
      });

      it('adds @requires information to fields using a nested field set', () => {
        const serviceA = {
          typeDefs: gql`
            type Product @key(fields: "sku { id }") {
              sku: Sku!
            }

            type Sku {
              id: ID!
              value: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            extend type Product {
              sku: Sku! @external
              price: Float! @requires(fields: "sku { id }")
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const product = schema.getType('Product') as GraphQLObjectType;
        expect(getFederationMetadata(product.getFields()['price'])?.requires)
          .toMatchInlineSnapshot(`
                                sku {
                                  id
                                }
                          `);
      });
    });

    // TODO: provides can happen on an extended type as well, add a test case for this
    describe('@provides directive', () => {
      it('adds @provides information to fields using a simple field set', () => {
        const serviceA = {
          typeDefs: gql`
            type Review {
              product: Product @provides(fields: "sku")
            }

            extend type Product {
              sku: String @external
              color: String
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            type Product @key(fields: "sku") {
              sku: String!
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const review = schema.getType('Review') as GraphQLObjectType;
        expect(getFederationMetadata(review.getFields()['product']))
          .toMatchInlineSnapshot(`
          Object {
            "belongsToValueType": false,
            "directiveUsages": Map {
              "provides" => Array [
                @provides(fields: "sku"),
              ],
            },
            "provides": sku,
            "serviceName": "serviceA",
          }
        `);
      });

      it('adds @provides information to fields using a nested field set', () => {
        const serviceA = {
          typeDefs: gql`
            type Review {
              product: Product @provides(fields: "sku { id }")
            }

            extend type Product {
              sku: Sku @external
              color: String
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            type Product @key(fields: "sku { id }") {
              sku: Sku!
              price: Int! @requires(fields: "sku")
            }

            type Sku {
              id: ID!
              value: String!
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const review = schema.getType('Review') as GraphQLObjectType;
        expect(getFederationMetadata(review.getFields()['product'])?.provides)
          .toMatchInlineSnapshot(`
                                sku {
                                  id
                                }
                          `);
      });

      it('adds @provides information for object types within list types', () => {
        const serviceA = {
          typeDefs: gql`
            type Review {
              products: [Product] @provides(fields: "sku")
            }

            extend type Product {
              sku: String @external
              color: String
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            type Product @key(fields: "sku") {
              sku: String!
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const review = schema.getType('Review') as GraphQLObjectType;
        expect(getFederationMetadata(review.getFields()['products']))
          .toMatchInlineSnapshot(`
          Object {
            "belongsToValueType": false,
            "directiveUsages": Map {
              "provides" => Array [
                @provides(fields: "sku"),
              ],
            },
            "provides": sku,
            "serviceName": "serviceA",
          }
        `);
      });

      it('adds correct @provides information to fields on value types', () => {
        const serviceA = {
          typeDefs: gql`
            extend type Query {
              valueType: ValueType
            }

            type ValueType {
              id: ID!
              user: User! @provides(fields: "id name")
            }

            type User @key(fields: "id") {
              id: ID!
              name: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            type ValueType {
              id: ID!
              user: User! @provides(fields: "id name")
            }

            extend type User @key(fields: "id") {
              id: ID! @external
              name: String! @external
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const valueType = schema.getType('ValueType') as GraphQLObjectType;
        const userFieldFederationMetadata = getFederationMetadata(
          valueType.getFields()['user'],
        );
        expect(userFieldFederationMetadata?.belongsToValueType).toBe(true);
        expect(userFieldFederationMetadata?.serviceName).toBe(null);
      });
    });

    describe('@key directive', () => {
      it('adds @key information to types using basic string notation', () => {
        const serviceA = {
          typeDefs: gql`
            type Product @key(fields: "sku") @key(fields: "upc") {
              sku: String!
              upc: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            extend type Product {
              sku: String! @external
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const product = schema.getType('Product') as GraphQLObjectType;
        expect(getFederationMetadata(product)?.keys).toMatchInlineSnapshot(`
                              Object {
                                "serviceA": Array [
                                  sku,
                                  upc,
                                ],
                              }
                        `);
      });

      it('adds @key information to types using selection set notation', () => {
        const serviceA = {
          typeDefs: gql`
            type Product @key(fields: "color { id value }") {
              sku: String!
              upc: String!
              color: Color!
            }

            type Color {
              id: ID!
              value: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            extend type Product {
              sku: String! @external
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const product = schema.getType('Product') as GraphQLObjectType;
        expect(getFederationMetadata(product)?.keys).toMatchInlineSnapshot(`
                              Object {
                                "serviceA": Array [
                                  color {
                                id
                                value
                              },
                                ],
                              }
                        `);
      });

      it('preserves @key information with respect to types across different services', () => {
        const serviceA = {
          typeDefs: gql`
            type Product @key(fields: "color { id value }") {
              sku: String!
              upc: String!
              color: Color!
            }

            type Color {
              id: ID!
              value: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            extend type Product @key(fields: "sku") {
              sku: String! @external
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB',
        };

        const compositionResult = composeServices([serviceA, serviceB]);
        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const product = schema.getType('Product') as GraphQLObjectType;
        expect(getFederationMetadata(product)?.keys).toMatchInlineSnapshot(`
                              Object {
                                "serviceA": Array [
                                  color {
                                id
                                value
                              },
                                ],
                                "serviceB": Array [
                                  sku,
                                ],
                              }
                        `);
      });
    });

    describe('@extends directive', () => {
      it('treats types with @extends as type extensions', () => {
        const serviceA = {
          typeDefs: gql`
            type Product @key(fields: "sku") {
              sku: String!
              upc: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            type Product @extends @key(fields: "sku") {
              sku: String! @external
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB',
        };

        const normalizedServices = [serviceA, serviceB].map(
          ({ name, typeDefs }) => ({
            name,
            typeDefs: normalizeTypeDefs(typeDefs),
          }),
        );
        const compositionResult = composeServices(normalizedServices);

        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const product = schema.getType('Product') as GraphQLObjectType;
        expect(product).toMatchInlineSnapshot(`
          type Product {
            price: Int!
            sku: String!
            upc: String!
          }
        `);
      });

      it('treats interfaces with @extends as interface extensions', () => {
        const serviceA = {
          typeDefs: gql`
            interface Product @key(fields: "sku") {
              sku: String!
              upc: String!
            }
          `,
          name: 'serviceA',
        };

        const serviceB = {
          typeDefs: gql`
            interface Product @extends @key(fields: "sku") {
              sku: String! @external
              price: Int! @requires(fields: "sku")
            }
          `,
          name: 'serviceB',
        };

        const normalizedServices = [serviceA, serviceB].map(
          ({ name, typeDefs }) => ({
            name,
            typeDefs: normalizeTypeDefs(typeDefs),
          }),
        );
        const compositionResult = composeServices(normalizedServices);

        assertCompositionSuccess(compositionResult);
        const { schema } = compositionResult;

        const product = schema.getType('Product') as GraphQLObjectType;
        expect(product).toMatchInlineSnapshot(`
          interface Product {
            price: Int!
            sku: String!
            upc: String!
          }
        `);
      });
    });
  });
  describe('executable directives', () => {
    it('keeps executable directives in the schema', () => {
      const serviceA = {
        typeDefs: gql`
          directive @defer on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
        `,
        name: 'serviceA',
      };

      const compositionResult = composeServices([serviceA]);

      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;

      const defer = schema.getDirective('defer') as GraphQLDirective;
      expect(defer).toMatchInlineSnapshot(`"@defer"`);
    });
    it('keeps executable directives in the schema', () => {
      const serviceA = {
        typeDefs: gql`
          directive @defer on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
        `,
        name: 'serviceA',
      };
      const serviceB = {
        typeDefs: gql`
          directive @stream on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
        `,
        name: 'serviceB',
      };

      const compositionResult = composeServices([serviceA, serviceB]);

      assertCompositionSuccess(compositionResult);
      const { schema } = compositionResult;

      const defer = schema.getDirective('defer') as GraphQLDirective;
      expect(defer).toMatchInlineSnapshot(`"@defer"`);

      const stream = schema.getDirective('stream') as GraphQLDirective;
      expect(stream).toMatchInlineSnapshot(`"@stream"`);
    });
  });

  it('extensions field on GraphQLSchema includes serviceList', () => {
    const serviceA = {
      typeDefs: gql`
        type Product {
          sku: String!
          name: String!
        }
      `,
      name: 'serviceA',
    };

    const serviceB = {
      typeDefs: gql`
        type User {
          name: String
          email: String!
        }
      `,
      name: 'serviceB',
    };

    const compositionResult = composeServices([serviceA, serviceB]);
    assertCompositionSuccess(compositionResult);
    const { schema } = compositionResult;
    expect(schema).toBeDefined();
    expect(schema.extensions?.serviceList).toBeDefined();
    expect(schema.extensions?.serviceList).toHaveLength(2);
  });
});

// XXX Ignored/unimplemented spec tests
// it("allows extension of custom scalars", () => {});
