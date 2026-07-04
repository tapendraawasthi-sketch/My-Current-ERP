"""Use tree-sitter to split TypeScript/TSX/JavaScript files into semantic chunks."""

from __future__ import annotations

from dataclasses import dataclass

import tree_sitter_javascript as tsjs
import tree_sitter_typescript as tsts
from tree_sitter import Language, Node, Parser

TS_LANGUAGE = Language(tsts.language_typescript())
TSX_LANGUAGE = Language(tsts.language_tsx())
JS_LANGUAGE = Language(tsjs.language())

_PARSERS = {
    ".ts": Parser(TS_LANGUAGE),
    ".tsx": Parser(TSX_LANGUAGE),
    ".js": Parser(TSX_LANGUAGE),
    ".jsx": Parser(TSX_LANGUAGE),
    ".mjs": Parser(JS_LANGUAGE),
    ".cjs": Parser(JS_LANGUAGE),
}
# Note: .js/.jsx are parsed with the TSX grammar deliberately — it is a strict
# superset that also handles plain JS and JSX, which is safer than guessing
# whether a .js file contains JSX.

TARGET_NODE_TYPES = {
    "function_declaration",
    "class_declaration",
    "method_definition",
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
}


@dataclass
class RawChunk:
    text: str
    name: str
    kind: str
    class_name: str
    start_line: int
    end_line: int


def _bump_to_export(node: Node) -> Node:
    p = node.parent
    if p is not None and p.type == "export_statement":
        return p
    return node


def _enclosing_class_name(node: Node) -> str:
    parent = node.parent
    while parent is not None:
        if parent.type == "class_declaration":
            name_node = parent.child_by_field_name("name")
            return name_node.text.decode("utf-8") if name_node else ""
        parent = parent.parent
    return ""


def _node_name(node: Node) -> str:
    name_node = node.child_by_field_name("name")
    if name_node is not None:
        return name_node.text.decode("utf-8", errors="replace")
    return "<anonymous>"


def _is_component_or_hook_declarator(node: Node) -> bool:
    if node.type != "variable_declarator":
        return False
    value = node.child_by_field_name("value")
    return value is not None and value.type in ("arrow_function", "function_expression")


def chunk_source(source_bytes: bytes, ext: str) -> list[RawChunk]:
    parser = _PARSERS.get(ext)
    if parser is None:
        return []
    tree = parser.parse(source_bytes)
    chunks: list[RawChunk] = []

    def walk(node: Node):
        if node.type in TARGET_NODE_TYPES:
            span = _bump_to_export(node)
            chunks.append(RawChunk(
                text=source_bytes[span.start_byte:span.end_byte].decode("utf-8", errors="replace"),
                name=_node_name(node),
                kind=node.type,
                class_name="" if node.type == "class_declaration" else _enclosing_class_name(node),
                start_line=span.start_point[0] + 1,
                end_line=span.end_point[0] + 1,
            ))
            if node.type == "class_declaration":
                for child in node.children:
                    walk(child)
            return
        if node.type == "variable_declarator" and _is_component_or_hook_declarator(node):
            declaration = node.parent
            span = declaration if declaration is not None and declaration.type in ("lexical_declaration", "variable_declaration") else node
            span = _bump_to_export(span)
            name_node = node.child_by_field_name("name")
            chunks.append(RawChunk(
                text=source_bytes[span.start_byte:span.end_byte].decode("utf-8", errors="replace"),
                name=name_node.text.decode("utf-8", errors="replace") if name_node else "<anonymous>",
                kind="component_or_function",
                class_name="",
                start_line=span.start_point[0] + 1,
                end_line=span.end_point[0] + 1,
            ))
            return
        for child in node.children:
            walk(child)

    walk(tree.root_node)
    return chunks
