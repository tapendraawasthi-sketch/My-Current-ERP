throw new Error("LEGACY SCRIPT DO NOT RUN");
const { Project, SyntaxKind } = require('ts-morph');
const project = new Project();
const sourceFile = project.addSourceFileAtPath('src/store/useStore.ts');

const arrowFuncs = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);

let modified = 0;
for (const arrowFunc of arrowFuncs) {
    if (arrowFunc.isAsync()) {
        const body = arrowFunc.getBody();
        if (body.getKind() === SyntaxKind.Block) {
            const bodyText = body.getText();
            if (bodyText.includes('getDB()')) {
                const statements = body.getStatements();
                if (statements.length > 0 && statements[0].getKind() !== SyntaxKind.TryStatement) {
                    const innerText = bodyText.substring(1, bodyText.length - 1);
                    // Use setBodyText directly with the inner content wrapped in try-catch
                    // setBodyText takes the *contents* of the body block, not the braces themselves
                    const newBodyText = 'try {\n' + innerText + '\n} catch (error) {\n  console.error("DB Error:", error);\n  throw error;\n}';
                    arrowFunc.setBodyText(newBodyText);
                    modified++;
                }
            }
        }
    }
}

console.log('Modified ' + modified + ' functions.');
project.saveSync();
