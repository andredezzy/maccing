// Form view renderer — fields with input widgets + submit button.

import { box } from "../../../box";
import { clip } from "../../../text";
import { databaseHeader } from "../header";
import { registerView } from "./engine";

interface FormField {
  label: string;
  fieldType?: string; // text | checkbox | select | date | person | number
}
export interface FormBlock {
  type: "form";
  name: string;
  views?: string[];
  fields: FormField[];
}

function renderForm(block: FormBlock, total: number): string[] {
  const widget = (fieldType?: string): string =>
    fieldType === "checkbox"
      ? "[ ]"
      : fieldType === "select"
        ? "[ ▾ ]"
        : fieldType === "date"
          ? "[ 📅 ]"
          : fieldType === "person"
            ? "[ @ ]"
            : "[ _____ ]";
  const fields = block.fields.map((field) => clip(`${field.label}:  ${widget(field.fieldType)}`, total - 2));
  return [databaseHeader(block.name, block.views, total), ...box([...fields, "", "[ Submit ]"], total - 2)];
}

registerView("form", renderForm);
