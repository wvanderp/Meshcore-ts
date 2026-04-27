import js from "@eslint/js";
import globals from "globals";
import stylistic from "@stylistic/eslint-plugin";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    globalIgnores(["dist", "node_modules", "coverage"]),
    {
        files: ["**/*.{ts}"],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            jsdoc.configs["flat/recommended-typescript"],
        ],
        plugins: {
            "@stylistic": stylistic,
        },
        languageOptions: {
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            /* --- Stylistic formatting --- */
            "@stylistic/indent": ["error", 4],
            "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
            "@stylistic/object-curly-spacing": ["error", "always"],
            "@stylistic/space-before-function-paren": ["error", { anonymous: "always", named: "never", asyncArrow: "always" }],
            "@stylistic/keyword-spacing": ["error", { before: true, after: true }],
            "@stylistic/space-infix-ops": "error",
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/no-trailing-spaces": "error",
            "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],

            /* --- JSDoc --- */
            "jsdoc/require-jsdoc": ["error", {
                require: {
                    FunctionDeclaration: false,
                    MethodDefinition: false,
                    ClassDeclaration: true,
                    ArrowFunctionExpression: false,
                    FunctionExpression: false,
                },
            }],
            "jsdoc/require-description": ["error", {
                contexts: ["ClassDeclaration"],
            }],
            "jsdoc/require-param": "off",
            "jsdoc/require-param-description": "error",
            "jsdoc/require-returns": "off",
            "jsdoc/require-returns-description": "off",
            "jsdoc/tag-lines": "off",
            "jsdoc/check-tag-names": "off",
            "jsdoc/require-example": ["error", {
                contexts: ["ClassDeclaration"],
            }],
        },
    },
]);
