import { API_URL, APIResponse, aurionPost, getSession, getSessionSignal } from "./helper";

export type PrintFolder = "WAITING" | "PRINTED";

export interface PrintJob {
    id: string;
    name: string;
    date: string;
    owner: string;
}

export interface PrintBalance {
    personal: number;
    bonus: number;
}

export async function fetchPrintJobs(folder: PrintFolder): Promise<APIResponse<PrintJob[]> | null> {
    return aurionPost<APIResponse<PrintJob[]>>("/print/jobs", { folder });
}

export async function deletePrintJobs(ids: string[]): Promise<APIResponse<never> | null> {
    return aurionPost<APIResponse<never>>("/print/jobs/delete", { ids });
}

export async function fetchPrintBalance(): Promise<APIResponse<PrintBalance> | null> {
    return aurionPost<APIResponse<PrintBalance>>("/print/balance");
}

export async function uploadPrintJob(file: File, bw: boolean, duplex: boolean): Promise<APIResponse<never> | null> {
    const session = getSession();
    if (!session) return null;
    try {
        const formData = new FormData();
        const fields = { email: session.email, password: session.password, bw: String(bw), duplex: String(duplex) };
        for (const [field, value] of Object.entries(fields)) formData.append(field, value);
        formData.append("importFile", file);
        const response = await fetch(`${API_URL}/print/jobs/upload`, {
            method: "POST",
            body: formData,
            signal: getSessionSignal(),
        });
        return response.ok ? response.json() : null;
    } catch {
        return null;
    }
}
