# Create API Endpoint

Generate a new API endpoint folder structure with all necessary files (schema, request, transformer, types, index).

## Usage

```bash
pnpm run mkar [method] [name] [dir] [queryType]
```

## Parameters

- **method** (optional, default: `get`) - HTTP method: `get`, `post`, `put`, `patch`, `delete`
- **name** (required) - API endpoint name in kebab-case (e.g., `get-users`, `update-profile`)
- **dir** (optional, default: `shared/api`) - Directory path where to create the endpoint
- **queryType** (optional) - Pass `--query` to generate React Query hook

## Examples

### Create a GET endpoint

```bash
pnpm run mkar get fetch-users
```

### Create a POST endpoint with React Query hook

```bash
pnpm run mkar post create-user shared/api --query
```

### Create a PUT endpoint in custom directory

```bash
pnpm run mkar put update-profile features/profile/api
```

## Generated Files

For endpoint `get-users`, generates:

```
src/shared/api/get-users/
├── backend-response.zod.ts  # Zod schema for API response
├── request.ts               # Main request function (+ React Query hook if --query flag)
├── transformer.ts           # Transform API response to app format
├── types.ts                 # TypeScript types for request/response
└── index.ts                 # Public API export
```

## Notes

- Folder will be created in `src/{dir}/{name.toLowerCase()}/`
- All files are scaffolded with TODO comments where you need to add your types
- For React Query hook generation, add `--query` flag as the last parameter
- Update `backend-response.zod.ts` with actual response schema from API
- Update `transformer.ts` to transform API data to app format
- Update `types.ts` with proper request/response types

<!-- TODO: make OpenAPI integration -->
