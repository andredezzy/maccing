// mirrors developers.notion.com/reference/page-property-values — discriminated union of all value types
import { z } from "zod";
import { buttonValue } from "./button-value";
import { checkboxValue } from "./checkbox-value";
import { createdByValue } from "./created-by-value";
import { createdTimeValue } from "./created-time-value";
import { dateValue } from "./date-value";
import { emailValue } from "./email-value";
import { filesValue } from "./files-value";
import { formulaValue } from "./formula-value";
import { lastEditedByValue } from "./last-edited-by-value";
import { lastEditedTimeValue } from "./last-edited-time-value";
import { multiSelectValue } from "./multi-select-value";
import { numberValue } from "./number-value";
import { peopleValue } from "./people-value";
import { phoneNumberValue } from "./phone-number-value";
import { relationValue } from "./relation-value";
import { richTextValue } from "./rich-text-value";
import { rollupValue } from "./rollup-value";
import { selectValue } from "./select-value";
import { statusValue } from "./status-value";
import { titleValue } from "./title-value";
import { uniqueIdValue } from "./unique-id-value";
import { urlValue } from "./url-value";
import { verificationValue } from "./verification-value";

export const propertyValue = z.discriminatedUnion("type", [
  titleValue,
  richTextValue,
  numberValue,
  selectValue,
  statusValue,
  multiSelectValue,
  dateValue,
  peopleValue,
  filesValue,
  checkboxValue,
  urlValue,
  emailValue,
  phoneNumberValue,
  formulaValue,
  relationValue,
  rollupValue,
  createdTimeValue,
  createdByValue,
  lastEditedTimeValue,
  lastEditedByValue,
  uniqueIdValue,
  verificationValue,
  buttonValue,
]);

export type PropertyValue = z.infer<typeof propertyValue>;
