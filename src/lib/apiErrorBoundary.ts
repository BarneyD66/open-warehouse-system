import { NextResponse } from "next/server";
import { recordApiError } from "./productionErrorStore";

export async function withApiErrorCapture(
  request: Request,
  route: string,
  handler: () => Promise<Response>,
  options: { actorName?: string; refId?: string } = {},
) {
  try {
    return await handler();
  } catch (error) {
    const event = await recordApiError({
      request,
      route,
      error,
      actorName: options.actorName,
      refId: options.refId,
    });
    return NextResponse.json({ error: "系统异常已记录，请联系运营负责人处理。", errorId: event.id }, { status: 500 });
  }
}
