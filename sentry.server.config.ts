import * as Sentry from "@sentry/nextjs";
import { serverSentryOptions } from "./lib/sentry";

Sentry.init(serverSentryOptions);
