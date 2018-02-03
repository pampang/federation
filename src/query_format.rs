use format::{Displayable, Formatter, Style};
use query::*;

impl Document {
    pub fn format(&self, style: &Style) -> String {
        let mut formatter = Formatter::new(style);
        self.display(&mut formatter);
        formatter.into_string()
    }
    pub fn to_string(&self) -> String {
        self.format(&Style::default())
    }
}

impl Displayable for Document {
    fn display(&self, f: &mut Formatter) {
        for item in &self.definitions {
            item.display(f);
        }
    }
}

impl Displayable for Definition {
    fn display(&self, f: &mut Formatter) {
        match *self {
            Definition::Operation(ref op) => op.display(f),
            Definition::Fragment(ref frag) => frag.display(f),
        }
    }
}

impl Displayable for OperationDefinition {
    fn display(&self, f: &mut Formatter) {
        match *self {
            OperationDefinition::SelectionSet(ref set) => set.display(f),
            _ => unimplemented!(),
        }
    }
}

impl Displayable for FragmentDefinition {
    fn display(&self, f: &mut Formatter) {
        unimplemented!();
    }
}

impl Displayable for SelectionSet {
    fn display(&self, f: &mut Formatter) {
        f.start_block();
        for item in &self.items {
            item.display(f);
        }
        f.end_block();
    }
}

impl Displayable for Selection {
    fn display(&self, f: &mut Formatter) {
        match *self {
            Selection::Field(ref fld) => fld.display(f),
            _ => unimplemented!(),
        }
    }
}

impl Displayable for Field {
    fn display(&self, f: &mut Formatter) {
        if let Some(ref alias) = self.alias {
            unimplemented!();
        }
        f.indent();
        f.write(&self.name);
        f.endline();
        // TODO(tailhook) other parts
    }
}
