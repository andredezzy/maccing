// Form view renderer — fields with input widgets + submit button.

import { box } from "../../../box";
import { clip } from "../../../text";
import { databaseHeader } from "../header";
import { registerView, type ViewRenderNode } from "./engine";
import { visibleColumns } from "./helpers";

function widget(fieldType?: string): string {
  switch (fieldType) {
    case "checkbox":
      return "[ ]";
    case "select":
    case "multi_select":
    case "status":
      return "[ ▾ ]";
    case "date":
      return "[ 📅 ]";
    case "people":
      return "[ @ ]";
    case "number":
      return "[ 0 ]";
    default:
      return "[ _____ ]";
  }
}

function renderForm(node: ViewRenderNode, total: number): string[] {
  const schema = node.dataSource.properties ?? {};
  const columns = visibleColumns(node.view, node.dataSource, node.titleColumn);

  const fields = columns.map((column) => {
    const fieldType = schema[column]?.type;
    return clip(`${column}:  ${widget(fieldType)}`, total - 2);
  });

  return [
    databaseHeader(node.dbTitle, node.tabs, node.view.name, total),
    ...box([...fields, "", "[ Submit ]"], total - 2),
  ];
}

registerView("form", renderForm);
