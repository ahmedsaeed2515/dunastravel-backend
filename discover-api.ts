import { Project, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
});

const sourceFiles = project.getSourceFiles('src/**/*.controller.ts');

const apiInventory: any[] = [];

sourceFiles.forEach((file) => {
  const classes = file.getClasses();
  classes.forEach((cls) => {
    const controllerDecorator = cls.getDecorator('Controller');
    if (!controllerDecorator) return;
    
    // Get Controller Route Prefix
    const arg = controllerDecorator.getArguments()[0];
    let prefix = '';
    if (arg && arg.getKind() === SyntaxKind.StringLiteral) {
      prefix = arg.getText().replace(/['"]/g, '');
    }

    const methods = cls.getMethods();
    methods.forEach((method) => {
      // Find HTTP method decorator
      const httpDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
      let methodType = '';
      let routePath = '';
      let isApiMethod = false;

      httpDecorators.forEach((dec) => {
        const decorator = method.getDecorator(dec);
        if (decorator) {
          isApiMethod = true;
          methodType = dec.toUpperCase();
          const routeArg = decorator.getArguments()[0];
          if (routeArg && routeArg.getKind() === SyntaxKind.StringLiteral) {
            routePath = routeArg.getText().replace(/['"]/g, '');
          }
        }
      });

      if (!isApiMethod) return;

      const fullRoute = `/api/${prefix}${routePath ? '/' + routePath : ''}`.replace(/\/+/g, '/');
      
      const params = method.getParameters().map(p => ({
        name: p.getName(),
        type: p.getType().getText(),
        decorators: p.getDecorators().map(d => d.getName())
      }));

      apiInventory.push({
        module: file.getDirectory().getBaseName(),
        controller: cls.getName(),
        action: method.getName(),
        method: methodType,
        route: fullRoute,
        params,
      });
    });
  });
});

fs.writeFileSync('api-inventory.json', JSON.stringify(apiInventory, null, 2));
console.log('API Inventory generated with ' + apiInventory.length + ' endpoints.');
