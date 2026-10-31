import { execSync } from 'child_process';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { camelCase, pascalCase } from 'change-case';

/** OpenAPI schema keys can be PHP FQCN with dots — invalid as JS identifiers. */
function toExportName(name) {
    if (/^[A-Za-z_$][\w$]*$/.test(name)) return name;
    return pascalCase(name);
}

function loadExternalSchema(filePath, baseDir) {
    try {
        const fullPath = resolve(baseDir, filePath);
        const content = readFileSync(fullPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`Warning: Could not load external schema ${filePath}:`, error);
        return {};
    }
}

function collectAllSchemas(schemas, externalSchemas, baseDir) {
    const collected = { ...schemas };
    const toProcess = new Set();
    const processed = new Set();
    const extraSchemas = { ...schemas };

    // Helper to add schema references to processing queue
    function addReferences(schema) {
        if (schema.$ref) {
            if (schema.$ref.includes('.yaml#') || schema.$ref.includes('.yml#')) {
                const [filePath, pointer] = schema.$ref.split('#');
                const [_, ...pointerParts] = pointer.split('/');
                const refName = pointerParts[pointerParts.length - 1];
                toProcess.add(`${filePath}#${refName}`);
            } else {
                const refName = schema.$ref.split('/').pop();
                toProcess.add(refName);
            }
        }

        // Check for nested references in objects and arrays
        if (schema.type === 'object' && schema.properties) {
            Object.values(schema.properties).forEach(addReferences);
        }
        if (schema.type === 'array' && schema.items) {
            addReferences(schema.items);
        }
        if (schema.allOf) {
            schema.allOf.forEach(addReferences);
        }
    }

    // Initial collection of references from main schemas
    Object.values(schemas).forEach(addReferences);

    // Process all references
    while (toProcess.size > 0) {
        const ref = toProcess.values().next().value;
        toProcess.delete(ref);

        if (processed.has(ref)) continue;
        processed.add(ref);

        let schema;

        if (ref.includes('#')) {
            const [filePath, refName] = ref.split('#');
            if (!externalSchemas[filePath]) {
                const externalSchema = loadExternalSchema(filePath, baseDir);
                const subCollected = collectAllSchemas(externalSchema.components?.schemas, externalSchemas, baseDir);
                externalSchemas[filePath] = externalSchema;
                schemas = { ...schemas, ...subCollected };
            }
            schema = externalSchemas[filePath].components?.schemas?.[refName];
        } else if (schemas[ref]) {
            schema = schemas[ref];
        }

        if (schema) {
            addReferences(schema);
            collected[ref] = schema;
        }
    }

    return collected;
}

function convertToZodType(schema, name, refs, externalSchemas, baseDir, processedRefs = new Set()) {
    if (schema.$ref) {
        // Handle circular references by falling back to any()
        if (processedRefs.has(schema.$ref)) {
            return 'z.any()';
        }
        processedRefs.add(schema.$ref);

        // Handle external references
        if (schema.$ref.includes('.yaml#') || schema.$ref.includes('.yml#')) {
            const [filePath, pointer] = schema.$ref.split('#');
            const [_, ...pointerParts] = pointer.split('/');

            // Load external schema if not already loaded
            if (!externalSchemas[filePath]) {
                externalSchemas[filePath] = loadExternalSchema(filePath, baseDir);
            }

            // Navigate to the referenced schema
            let referencedSchema = externalSchemas[filePath];
            for (const part of pointerParts) {
                referencedSchema = referencedSchema?.[part];
            }

            if (!referencedSchema) {
                console.warn(`Warning: Could not resolve external reference ${schema.$ref}, falling back to any()`);
                return 'z.any()';
            }

            // Convert the referenced schema, passing along the processedRefs
            const externalRefName = toExportName(pointerParts[pointerParts.length - 1]);
            return convertToZodType(referencedSchema, externalRefName, refs, externalSchemas, baseDir, processedRefs);
        }

        // Handle internal references
        const refName = toExportName(schema.$ref.split('/').pop());
        if (refName !== name) {
            refs.add(refName);
            return refName;
        }
        return 'z.any()';
    }

    // Handle self-referential schemas
    if (!schema.type && !schema.$ref && !schema.allOf && !schema.enum) {
        // If the schema directly references itself, default to a string schema
        if (name === schema) {
            return 'z.string()';
        }

        // Check for other direct type assignments
        const referencedType = name.replace(/Config$|Update$/, '');
        if (referencedType !== name && refs.has(referencedType)) {
            refs.add(referencedType);
            return referencedType;
        }
        // Fall back to a safe default if the referenced type doesn't exist
        return 'z.object({}).passthrough()';
    }

    if (schema.oneOf) {
        const unionTypes = schema.oneOf.map((s) =>
            convertToZodType(s, name, refs, externalSchemas, baseDir, processedRefs),
        );
        return `z.union([${unionTypes.join(', ')}])`;
    }

    if (schema.allOf) {
        const [baseSchema, ...extensions] = schema.allOf;
        const baseType = convertToZodType(baseSchema, name + 'Base', refs, externalSchemas, baseDir, processedRefs);

        const extensionProperties = {};
        const extensionRequired = [];

        extensions.forEach((ext) => {
            // Handle references in extensions
            if (ext.$ref) {
                const resolvedExt = resolveReference(ext.$ref, externalSchemas, baseDir);
                if (resolvedExt?.properties) {
                    Object.assign(extensionProperties, resolvedExt.properties);
                }
                if (resolvedExt?.required) {
                    extensionRequired.push(...resolvedExt.required);
                }
            } else {
                if (ext.properties) {
                    Object.assign(extensionProperties, ext.properties);
                }
                if (ext.required) {
                    extensionRequired.push(...ext.required);
                }
            }
        });

        if (Object.keys(extensionProperties).length === 0) {
            return baseType;
        }

        const extensionRequiredSet = new Set(extensionRequired);
        const propertyDefinitions = Object.entries(extensionProperties).map(([key, prop]) => {
            const zodType = convertToZodType(prop, pascalCase(key), refs, externalSchemas, baseDir, processedRefs);
            const isRequired = extensionRequiredSet.has(key);
            const description = prop.description ? `.describe(${JSON.stringify(prop.description)})` : '';
            const safeKey = key.includes('-') ? `'${camelCase(key)}'` : key;
            return `${safeKey}: ${zodType}${isRequired ? '' : '.optional()'}${description}`;
        });

        return `${baseType}.extend({
      ${propertyDefinitions.join(',\n      ')}
    })`;
    }

    if (schema.anyOf) {
        const unionTypes = schema.anyOf.map((s) =>
            convertToZodType(s, name, refs, externalSchemas, baseDir, processedRefs),
        );
        return `z.union([${unionTypes.join(', ')}])`;
    }

    if (schema.enum) {
        const enumValues = schema.enum.map((v) => JSON.stringify(v));
        return `z.enum([${enumValues.join(', ')}])`;
    }

    switch (schema.type) {
        case 'string':
            if (schema.format === 'date-time') {
                return 'z.string().datetime()';
            }
            return 'z.string()';

        case 'number':
        case 'integer':
            return 'z.number()';

        case 'boolean':
            return 'z.boolean()';

        case 'array':
            const itemType = convertToZodType(
                schema.items,
                name + 'Item',
                refs,
                externalSchemas,
                baseDir,
                processedRefs,
            );
            return `z.array(${itemType})`;

        case 'object':
            if (schema.additionalProperties === true) {
                return 'z.record(z.any())';
            }
            if (typeof schema.additionalProperties === 'object') {
                const valueType = convertToZodType(
                    schema.additionalProperties,
                    name + 'Value',
                    refs,
                    externalSchemas,
                    baseDir,
                    processedRefs,
                );
                return `z.record(${valueType})`;
            }

            const properties = schema.properties || {};
            const requiredSet = new Set(schema.required || []);

            const propertyDefinitions = Object.entries(properties).map(([key, prop]) => {
                const zodType = convertToZodType(prop, pascalCase(key), refs, externalSchemas, baseDir, processedRefs);
                const isRequired = requiredSet.has(key);
                const description = prop.description ? `.describe(${JSON.stringify(prop.description)})` : '';
                const safeKey = key.includes('-') ? `'${camelCase(key)}'` : key;
                return `${safeKey}: ${zodType}${isRequired ? '' : '.optional()'}${description}`;
            });

            return `z.object({
        ${propertyDefinitions.join(',\n        ')}
      })`;

        default:
            return 'z.any()';
    }
}

function resolveReference(ref, externalSchemas, baseDir) {
    if (ref.includes('.yaml#') || ref.includes('.yml#')) {
        const [filePath, pointer] = ref.split('#');
        const [_, ...pointerParts] = pointer.split('/');

        if (!externalSchemas[filePath]) {
            externalSchemas[filePath] = loadExternalSchema(filePath, baseDir);
        }

        let referencedSchema = externalSchemas[filePath];
        for (const part of pointerParts) {
            referencedSchema = referencedSchema?.[part];
        }

        if (!referencedSchema) {
            console.warn(`Warning: Could not resolve reference ${ref}, falling back to any()`);
            return { type: 'any' };
        }

        return referencedSchema;
    }

    return null;
}

function generateZodSchemas(spec, baseDir) {
    const imports = ['import { z } from "zod"\n'];
    const schemas = [];
    const dependencies = new Map();
    const externalSchemas = {};

    // Collect all schemas including referenced ones
    const allSchemas = collectAllSchemas(spec.components.schemas, externalSchemas, baseDir);

    // Generate schemas for all collected types
    for (const [name, schema] of Object.entries(allSchemas)) {
        const exportName = toExportName(name);
        const refs = new Set();

        if (schema === name || (typeof schema === 'object' && schema.$ref === `#/components/schemas/${name}`)) {
            schemas.push(`export const ${exportName} = z.string()
`);
            continue;
        }

        const zodSchema = convertToZodType(schema, exportName, refs, externalSchemas, baseDir);
        dependencies.set(exportName, refs);

        const description = schema.description ? `/**\n * ${schema.description}\n */\n` : '';

        schemas.push(`${description}export const ${exportName} = ${zodSchema}
`);
    }

    // Topological sort to handle dependencies
    const sortedSchemas = [];
    const addedSchemas = new Set();
    const processing = new Set();

    function addSchema(name) {
        // Skip if already added
        if (addedSchemas.has(name)) return;

        // Detect circular dependencies
        if (processing.has(name)) {
            console.warn(`Warning: Circular dependency detected for ${name}`);
            return;
        }

        processing.add(name);

        // Process dependencies first
        const deps = dependencies.get(name) || new Set();
        for (const dep of deps) {
            addSchema(dep);
        }

        processing.delete(name);

        // Add schema after dependencies
        const schemaIndex = schemas.findIndex((s) => s.includes(`export const ${name} =`));
        if (schemaIndex !== -1) {
            sortedSchemas.push(schemas[schemaIndex]);
            addedSchemas.add(name);
        }
    }

    // Process all schemas
    for (const name of Object.keys(spec.components.schemas)) {
        addSchema(toExportName(name));
    }

    return [...imports, ...sortedSchemas].join('\n');
}

function buildOpenApiFetchInit(resource) {
    if (!/^https?:\/\//i.test(resource)) {
        return {};
    }
    const headers = {};
    const user = process.env.HTTP_AUTH_USER;
    const password = process.env.HTTP_AUTH_PASSWORD;

    if (user !== undefined && password !== undefined) {
        headers.Authorization = `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
    }

    return Object.keys(headers).length ? { headers } : {};
}

// Update the main execution to pass the base directory
const inputFile = process.argv[2];
if (!inputFile) {
    console.error('Please provide an input file');
    process.exit(1);
}

const baseDir = resolve(process.cwd(), 'src/shared/api/generated');
const fetchInit = buildOpenApiFetchInit(inputFile);
const res = await fetch(inputFile, fetchInit);

if (!res.ok) {
    console.error(`OpenAPI fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
}

const spec = await res.json();
const output = generateZodSchemas(spec, baseDir);

// Write to file
const outputPath = resolve(baseDir, 'generated-schemas.ts');
fs.writeFileSync(outputPath, output);

try {
    execSync(`npx oxfmt ${outputPath}`, { stdio: 'inherit' });
    console.log('Successfully generated and formatted Zod schemas!');
} catch (error) {
    console.log('Generated Zod schemas, but failed to format with oxfmt:', error.message);
}
