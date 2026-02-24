import * as Sentry from "@sentry/nextjs";
import { edgeSentryOptions } from "./lib/sentry";

Sentry.init(edgeSentryOptions);
