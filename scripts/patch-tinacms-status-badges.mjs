import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targetPath = resolve(process.cwd(), 'node_modules/tinacms/dist/index.js');
const patchMarker = 'inline-flex flex-none items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800';

if (!existsSync(targetPath)) {
  console.warn(`[patch-tinacms-status-badges] Skipping; ${targetPath} was not found.`);
  process.exit(0);
}

let source = readFileSync(targetPath, 'utf8');

if (source.includes(patchMarker)) {
  console.log('[patch-tinacms-status-badges] Tina collection list badge patch already applied.');
  process.exit(0);
}

const replacements = [
  {
    search: `                ... on Document {
                  _sys {
                    title
                    template
                    breadcrumbs
                    path
                    basename
                    relativePath
                    filename
                    extension
                    hasReferences
                  }
                }`,
    replace: `                ... on Document {
                  _sys {
                    title
                    template
                    breadcrumbs
                    path
                    basename
                    relativePath
                    filename
                    extension
                    hasReferences
                  }
                  _values
                }`,
  },
  {
    search: `                ... on Document {
                  _sys {
                    title
                    template
                    breadcrumbs
                    path
                    basename
                    relativePath
                    filename
                    extension
                  }
                }`,
    replace: `                ... on Document {
                  _sys {
                    title
                    template
                    breadcrumbs
                    path
                    basename
                    relativePath
                    filename
                    extension
                  }
                  _values
                }`,
  },
  {
    search: `            const hasTitle = Boolean(
              document2.node._sys.title
            );`,
    replace: `            const documentStatus = document2.node._values && document2.node._values.status === "draft" ? "draft" : "published";
            const hasTitle = Boolean(
              document2.node._sys.title
            );`,
  },
  {
    search: `                  /* @__PURE__ */ React__default.createElement("span", { className: "truncate block" }, /* @__PURE__ */ React__default.createElement("span", { className: "leading-5 block truncate mb-1" }, !folderView && !hasTitle && subfolders && /* @__PURE__ */ React__default.createElement("span", { className: "text-xs text-gray-400" }, \`${'${subfolders}/'}\`), /* @__PURE__ */ React__default.createElement("span", null, hasTitle ? (_a2 = document2.node._sys) == null ? void 0 : _a2.title : document2.node._sys.filename)), /* @__PURE__ */ React__default.createElement("span", { className: "block text-xs text-gray-400" }, document2.node._sys.path))`,
    replace: `                  /* @__PURE__ */ React__default.createElement("span", { className: "truncate block" }, /* @__PURE__ */ React__default.createElement("div", { className: "mb-1 flex min-w-0 items-center gap-2" }, /* @__PURE__ */ React__default.createElement("span", { className: "block min-w-0 truncate leading-5" }, !folderView && !hasTitle && subfolders && /* @__PURE__ */ React__default.createElement("span", { className: "text-xs text-gray-400" }, \`${'${subfolders}/'}\`), /* @__PURE__ */ React__default.createElement("span", null, hasTitle ? (_a2 = document2.node._sys) == null ? void 0 : _a2.title : document2.node._sys.filename)), documentStatus === "draft" && /* @__PURE__ */ React__default.createElement("span", { className: "inline-flex flex-none items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800" }, "Draft")), /* @__PURE__ */ React__default.createElement("span", { className: "block text-xs text-gray-400" }, document2.node._sys.path))`,
  },
];

for (const { search, replace } of replacements) {
  if (!source.includes(search)) {
    throw new Error('[patch-tinacms-status-badges] Expected Tina source snippet was not found. The installed Tina version may have changed.');
  }

  source = source.replace(search, replace);
}

writeFileSync(targetPath, source, 'utf8');
console.log('[patch-tinacms-status-badges] Tina collection list badge patch applied.');