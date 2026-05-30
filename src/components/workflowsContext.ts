import { createContext } from "react";
import { DEFAULT_WORKFLOWS, type WorkflowSettings } from "../types";

export const WorkflowsContext = createContext<WorkflowSettings>(DEFAULT_WORKFLOWS);
