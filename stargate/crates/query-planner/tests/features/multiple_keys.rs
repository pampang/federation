// Autogenerated by stargate/crates/query-planner/build.rs
//  ######   ######## ##    ## ######## ########     ###    ######## ######## ########  
// ##    ##  ##       ###   ## ##       ##     ##   ## ##      ##    ##       ##     ## 
// ##        ##       ####  ## ##       ##     ##  ##   ##     ##    ##       ##     ## 
// ##   #### ######   ## ## ## ######   ########  ##     ##    ##    ######   ##     ## 
// ##    ##  ##       ##  #### ##       ##   ##   #########    ##    ##       ##     ## 
// ##    ##  ##       ##   ### ##       ##    ##  ##     ##    ##    ##       ##     ## 
//  ######   ######## ##    ## ######## ##     ## ##     ##    ##    ######## ########
//
// This file is autogenerated by stargate/crates/query-planner/build.rs by scanning the tests for *.feature files.
// To add a feature to the test corpus, don't edit this file. Instead, just
// add a new .feature files to the tests/features directory.
// The tests are added sorted by name so that different machines building will not yield a git diff.

use apollo_query_planner::QueryPlanningOptions;
use crate::helpers::assert_query_plan;


#[allow(non_snake_case)]
#[test]
fn multiple_keys_multiple_key_fields() {
    assert_query_plan(
        include_str!("multiple_keys/schema.graphql"),
        r##"
query {
  reviews {
    body
    author {
      name
      risk
    }
  }
}
"##,
        r##"
{
  "kind": "QueryPlan",
  "node": {
    "kind": "Sequence",
    "nodes": [
      {
        "kind": "Fetch",
        "serviceName": "reviews",
        "variableUsages": [],
        "operation": "{reviews{body author{__typename id}}}"
      },
      {
        "kind": "Flatten",
        "path": ["reviews", "@", "author"],
        "node": {
          "kind": "Fetch",
          "serviceName": "users",
          "requires": [
            {
              "kind": "InlineFragment",
              "typeCondition": "User",
              "selections": [
                { "kind": "Field", "name": "__typename" },
                { "kind": "Field", "name": "id" }
              ]
            }
          ],
          "variableUsages": [],
          "operation": "query($representations:[_Any!]!){_entities(representations:$representations){...on User{name __typename ssn}}}"
        }
      },
      {
        "kind": "Flatten",
        "path": ["reviews", "@", "author"],
        "node": {
          "kind": "Fetch",
          "serviceName": "actuary",
          "requires": [
            {
              "kind": "InlineFragment",
              "typeCondition": "User",
              "selections": [
                { "kind": "Field", "name": "__typename" },
                { "kind": "Field", "name": "ssn" }
              ]
            }
          ],
          "variableUsages": [],
          "operation": "query($representations:[_Any!]!){_entities(representations:$representations){...on User{risk}}}"
        }
      }
    ]
  }
}
"##,
        QueryPlanningOptions {
            auto_fragmentization: false
        }
    );
}

