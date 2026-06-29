const { Project, SyntaxKind } = require("ts-morph");

const project = new Project();
const sourceFile = project.addSourceFileAtPath("src/components/BusyShell.tsx");

// Handle complex object replacements first
sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).forEach((obj) => {
  const props = obj.getProperties();
  const hasPropWithValue = (name, val) =>
    props.some(
      (p) =>
        p.isKind(SyntaxKind.PropertyAssignment) &&
        p.getName() === name &&
        p.getInitializerIfKind(SyntaxKind.StringLiteral)?.getLiteralValue() === val,
    );

  if (hasPropWithValue("background", "#c8d4e0") && hasPropWithValue("textAlign", "center")) {
    obj.getProperty("background").getInitializer().setLiteralValue("#162a46");
    if (!obj.getProperty("color")) {
      obj.addPropertyAssignment({ name: "color", initializer: '"#ffffff"' });
    }
  }

  if (
    hasPropWithValue("border", "1px solid #808080") &&
    hasPropWithValue("background", "#fff") &&
    hasPropWithValue("color", "#000")
  ) {
    obj.getProperty("border").getInitializer().setLiteralValue("1px solid #1b3a5c");
    obj.getProperty("background").getInitializer().setLiteralValue("#162a46");
    obj.getProperty("color").getInitializer().setLiteralValue("#ffffff");
  }
});

// Handle simple string replacements in Jsx contexts
sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach((strNode) => {
  const val = strNode.getLiteralValue();
  const parent = strNode.getParent();
  const isInsideJsx =
    strNode.getFirstAncestorByKind(SyntaxKind.JsxElement) ||
    strNode.getFirstAncestorByKind(SyntaxKind.JsxSelfClosingElement);

  if (isInsideJsx) {
    if (parent.isKind(SyntaxKind.PropertyAssignment)) {
      const propName = parent.getName();
      if (val === "#1f2a44" && propName === "background") strNode.setLiteralValue("#0d1b2a");
      else if (val === "#1557b0" && propName === "background") strNode.setLiteralValue("#2563eb");
      else if (val === "#e0e0e0" && propName === "background") strNode.setLiteralValue("#0d1b2a");
      else if (
        val === "1px solid #a0a0a0" &&
        ["borderTop", "borderRight", "borderLeft", "borderBottom"].includes(propName)
      )
        strNode.setLiteralValue("1px solid #1b3a5c");
      else if (val === "#1557b0" && propName === "color") strNode.setLiteralValue("#60a5fa");
      else if (val === "#555" && propName === "color") strNode.setLiteralValue("#94a3b8");
      else if (val === "#cc0000" && propName === "background") strNode.setLiteralValue("#f08a2c");
      else if (val === "#d8d8d8" && propName === "background") strNode.setLiteralValue("#162a46");
      else if (val === "1px solid #bbb" && propName === "borderTop")
        strNode.setLiteralValue("1px solid #1b3a5c");
      else if (val === "#444" && propName === "color") strNode.setLiteralValue("#94a3b8");
      else if (val === "#f0f0f0" && propName === "background") strNode.setLiteralValue("#0d1b2a");
      else if (val === "1px solid #d0d0d0" && propName === "borderBottom")
        strNode.setLiteralValue("1px solid #1b3a5c");
      else if (val === "#e8e8e8" && propName === "background") strNode.setLiteralValue("#0d1b2a");
      else if (val === "#8b1a1a" && propName === "color") strNode.setLiteralValue("#f08a2c");
      else if (val === "#000" && propName === "color") strNode.setLiteralValue("#ffffff");
      else if (val === "#e8e4f0" && propName === "background") strNode.setLiteralValue("#0d1b2a");
      else if (val === "1px solid #a89cc4" && propName === "border")
        strNode.setLiteralValue("1px solid #1b3a5c");
    } else if (parent.isKind(SyntaxKind.ConditionalExpression)) {
      if (val === "#d0e0f5") strNode.setLiteralValue("#1b3a5c");
      else if (val === "#e8e8e8") strNode.setLiteralValue("#0d1b2a");
    }
  }
});

sourceFile.saveSync();
console.log("Updated BusyShell.tsx via AST");
