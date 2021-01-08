use std::{io::Write, fs::{read_dir, read_to_string, write, File}};
use std::path::PathBuf;

use harmonizer::{harmonize, ServiceDefinition};

/// This test looks over all directories under tests/features and finds "csdl.graphql" in
/// each of those directories. It runs all of the .feature cases in that directory against that schema.
/// To add test cases against new schemas, create a sub directory under "features" with the new schema
/// and new .feature files.
fn main() {
    // If debugging with IJ, use `read_dir("query-planner/tests/features")`
    // let dirs = read_dir("query-planner/tests/features")
    let dirs =
        read_dir(PathBuf::from("tests").join("features"))
            .expect("read features dir")
            .map(|res| res.map(|e| e.path()).unwrap())
            .filter(|d| d.is_dir());

    for dir in dirs {
        write_composed_schema(&dir).expect("composition");
        write_tests(&dir).expect("generating test files");
    }
}

fn write_composed_schema(dir: &PathBuf) -> std::io::Result<()> {
    let schema_paths = read_dir(dir)
        .unwrap()
        .map(|res| res.map(|e| e.path()).unwrap())
        .filter(|e| {
            match (e.extension(), e.file_name()) {
                (Some(ext), Some(name)) =>
                    ext == "graphql" && name != "schema.graphql",
                _ => false,
            }
        })
        .map(|path| {
            println!("cargo:rerun-if-changed={}", path.to_str().expect("path to string"));
            path
        })
        .map(|path| ServiceDefinition {
            name: path.file_stem().expect("input schema should have a file stem")
                .to_str()
                .expect("file path to string")
                .to_owned(),
            type_defs: read_to_string(path)
                .expect("reading input schema"),
            url: "undefined".to_owned(),
        });

    let composed = harmonize(schema_paths.collect());
    use harmonizer::Result::*;
    match composed {
        Ok(schema) => write(dir.join("schema.graphql"), schema),
        Err(errors) => {
            let mut message = String::new();
            for err in &errors {
                message.push_str(&err.message);
                message.push('\n');
            }
            panic!(message);
        }
    }
}


use gherkin_rust::Feature;
use gherkin_rust::StepType;


macro_rules! get_step {
    ($scenario:ident, $typ:pat) => {
        $scenario
            .steps
            .iter()
            .find(|s| matches!(s.ty, $typ))
            .unwrap()
            .docstring
            .as_ref()
            .unwrap()
    };
}

fn write_tests(dir: &PathBuf) -> std::io::Result<()> {
    let feature_paths = read_dir(dir)
        .unwrap()
        .map(|res| res.map(|e| e.path()).unwrap())
        .filter(|e| {
            if let Some(d) = e.extension() {
                d == "feature"
            } else {
                false
            }
        });

    let output_path = dir.with_extension("rs");
    let mut output = File::create(&output_path)
        .expect("opening output file");

    let schema_path_str = format!("{}/schema.graphql",
        dir.file_name().expect("feature dir has filename")
            .to_str().expect("schema filename"));

    output.write(format!(
        r#"// Autogenerated by {me}
//  ######   ######## ##    ## ######## ########     ###    ######## ######## ########  
// ##    ##  ##       ###   ## ##       ##     ##   ## ##      ##    ##       ##     ## 
// ##        ##       ####  ## ##       ##     ##  ##   ##     ##    ##       ##     ## 
// ##   #### ######   ## ## ## ######   ########  ##     ##    ##    ######   ##     ## 
// ##    ##  ##       ##  #### ##       ##   ##   #########    ##    ##       ##     ## 
// ##    ##  ##       ##   ### ##       ##    ##  ##     ##    ##    ##       ##     ## 
//  ######   ######## ##    ## ######## ##     ## ##     ##    ##    ######## ########
//
// This file is autogenerated by {me} by scanning the tests for *.feature files.
// To add a feature to the test corpus, don't edit this file. Instead, just
// add a new .feature files to the tests/features directory.
// The tests are added sorted by name so that different machines building will not yield a git diff.

use apollo_query_planner::QueryPlanningOptions;
use crate::helpers::assert_query_plan;

"#, me = file!()).as_bytes())?;

    for path in feature_paths {
        let feature = read_to_string(&path).unwrap();
        let feature_name = path.file_stem()
            .expect("feature path has a file stem")
            .to_str()
            .expect("unicode conversion of feature path name");

        let feature = match Feature::parse(feature) {
            Result::Ok(feature) => feature,
            Result::Err(e) => panic!("Unparseable .feature file {:?} -- {}", &path, e),
        };


        for scenario in feature.scenarios {
            let query: &str = get_step!(scenario, StepType::Given);
            let expected: &str = get_step!(scenario, StepType::Then);

            let auto_fragmentization = scenario
                .steps
                .iter()
                // FIXME -- we don't currently check the content of the When, just assume that
                // it says "When using auto_framgentation"
                .any(|s| matches!(s.ty, StepType::When));

            let base_name = format!("{}_{}", feature_name, scenario.name);
                
            let clean_name: String = base_name.to_lowercase().chars()
                .filter(|c| match c {
                    '@' | '\'' | '"' | ',' | '/' | '.' | '(' | ')' | ':' | '[' | ']' => false,
                    _ => true,
                })
                .map(
                    |c| match c {
                        ' ' | '-' => '_',
                        _ => c
                    }
                )
                .collect();
            
            let test = format!(r###"
#[allow(non_snake_case)]
#[test]
fn {}() {{
    assert_query_plan(
        include_str!("{}"),
        r##"{}"##,
        r##"{}"##,
        QueryPlanningOptions {{
            auto_fragmentization: {}
        }}
    );
}}

"###, clean_name, schema_path_str, query, expected, auto_fragmentization);
            output.write(test.as_bytes())?;
        }
    }

    Ok(())
}