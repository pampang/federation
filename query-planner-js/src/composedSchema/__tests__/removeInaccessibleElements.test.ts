import {
  buildSchema,
  assertValidSchema,
  GraphQLObjectType,
  GraphQLUnionType,
} from 'graphql';
import { removeInaccessibleElements } from '../removeInaccessibleElements';

describe('removeInaccessibleElements', () => {
  it(`removes @inaccessible fields`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        someField: String
        privateField: String @inaccessible
      }
    `);

    schema = removeInaccessibleElements(schema);

    const queryType = schema.getQueryType()!;

    expect(queryType.getFields()['someField']).toBeDefined();
    expect(queryType.getFields()['privateField']).toBeUndefined();
  });

  it(`removes @inaccessible object types`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        fooField: Foo @inaccessible
      }

      type Foo @inaccessible {
        someField: String
      }

      union Bar = Foo
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getType('Foo')).toBeUndefined();
  });

  it(`removes @inaccessible interface types`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        fooField: Foo @inaccessible
      }

      interface Foo @inaccessible {
        someField: String
      }

      type Bar implements Foo {
        someField: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getType('Foo')).toBeUndefined();
    const barType = schema.getType('Bar') as GraphQLObjectType | undefined;
    expect(barType).toBeDefined();
    expect(barType?.getFields()['someField']).toBeDefined();
    expect(barType?.getInterfaces()).toHaveLength(0);
  });

  it(`removes @inaccessible union types`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        fooField: Foo @inaccessible
      }

      union Foo @inaccessible = Bar | Baz

      type Bar {
        someField: String
      }

      type Baz {
        anotherField: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getType('Foo')).toBeUndefined();
    expect(schema.getType('Bar')).toBeDefined();
    expect(schema.getType('Baz')).toBeDefined();
  });

  it(`removes @inaccessible types from a union's types`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        fooField: Foo @inaccessible
      }

      union Foo = Bar | Baz

      type Bar @inaccessible {
        someField: String
      }

      type Baz {
        anotherField: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    const fooType = schema.getType('Foo') as GraphQLUnionType;
    expect(fooType).toBeDefined();
    expect(fooType.getTypes()).toHaveLength(1);
  });

  it(`removes a union type if all of its types are @inaccessible`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        fooField: Foo @inaccessible
      }

      union Foo = Bar | Baz

      type Bar @inaccessible {
        someField: String
      }

      type Baz @inaccessible {
        anotherField: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getType('Bar')).toBeUndefined();
    expect(schema.getType('Baz')).toBeUndefined();
    expect(schema.getType('Foo')).toBeUndefined();
  });

  it(`removes deeply nested inaccessible unions`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        fooField: Foo @inaccessible
      }

      union Foo4 = Foo3 | Bar
      union Foo3 = Foo2 | Bar
      union Foo2 = Foo | Bar
      union Foo = Bar | Baz

      type Bar @inaccessible {
        someField: String
      }

      type Baz @inaccessible {
        anotherField: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getType('Foo')).toBeUndefined();
    expect(schema.getType('Foo2')).toBeUndefined();
    expect(schema.getType('Foo3')).toBeUndefined();
    expect(schema.getType('Foo4')).toBeUndefined();
  });

  it(`removes interface implementations whose interface is inaccessible`, () => {
    let schema = buildSchema(`#graphql
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        impl: Impl @inaccessible
      }

      interface Foo @inaccessible {
        id: String
      }

      type Impl implements Foo {
        id: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getType('Foo')).toBeUndefined();
    expect(schema.getType('Impl')).toBeUndefined();
  });

  it(`removes fields which return an implementation whose interface is inaccessible`, () => {
    let schema = buildSchema(`#graphql
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        impl: Impl @inaccessible
        other: String
      }

      interface Foo @inaccessible {
        id: String
      }

      type Impl implements Foo {
        id: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getType('Foo')).toBeUndefined();
    expect(schema.getType('Impl')).toBeUndefined();
    expect(
      (schema.getType('Query') as GraphQLObjectType).getFields()['impl'],
    ).toBeUndefined();

  });

  it(`throws when a field returning an @inaccessible type isn't marked @inaccessible itself`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        fooField: Foo
      }

      type Foo @inaccessible {
        someField: String
      }

      union Bar = Foo
    `);

    expect(() => {
      removeInaccessibleElements(schema);
    }).toThrow(
      `Field Query.fooField returns an @inaccessible type without being marked @inaccessible itself`,
    );
  });

  it(`removes @inaccessible query root type`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query @inaccessible {
        fooField: Foo
      }

      type Foo {
        someField: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getQueryType()).toBeUndefined();
    expect(schema.getType('Query')).toBeUndefined();

    expect(() => assertValidSchema(schema)).toThrow();
  });

  it(`removes @inaccessible mutation root type`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
        mutation: Mutation
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        fooField: Foo
      }

      type Mutation @inaccessible {
        fooField: Foo
      }

      type Foo {
        someField: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getMutationType()).toBeUndefined();
    expect(schema.getType('Mutation')).toBeUndefined();
  });

  it(`removes @inaccessible subscription root type`, () => {
    let schema = buildSchema(`
      directive @core(feature: String!, as: String, for: core__Purpose) repeatable on SCHEMA

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

      schema
        @core(feature: "https://specs.apollo.dev/core/v0.2")
        @core(feature: "https://specs.apollo.dev/inaccessible/v0.1")
      {
        query: Query
        subscription: Subscription
      }

      enum core__Purpose {
        EXECUTION
        SECURITY
      }

      type Query {
        fooField: Foo
      }

      type Subscription @inaccessible {
        fooField: Foo
      }

      type Foo {
        someField: String
      }
    `);

    schema = removeInaccessibleElements(schema);

    expect(schema.getSubscriptionType()).toBeUndefined();
    expect(schema.getType('Subscription')).toBeUndefined();
  });
});
