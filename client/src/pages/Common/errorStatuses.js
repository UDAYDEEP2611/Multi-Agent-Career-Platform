// What the status pages say for each standard 3xx, 4xx and 5xx code
export const STATUSES = {
  300: { title: "Multiple choices", message: "There's more than one version of this page. Go back and choose another link." },
  301: { title: "Page moved", message: "This page has moved permanently to a new address." },
  302: { title: "Page temporarily moved", message: "This page is at another address for now." },
  303: { title: "See another page", message: "What you're looking for is on another page." },
  304: { title: "Not modified", message: "This page hasn't changed since you last loaded it." },
  307: { title: "Temporary redirect", message: "This page is at another address for now." },
  308: { title: "Permanent redirect", message: "This page has moved permanently to a new address." },

  400: { title: "Bad request", message: "We couldn't understand that request. Check the link and try again." },
  401: { title: "Please log in", message: "You need to log in to see this page." },
  402: { title: "Payment required", message: "This page needs a payment before it can be opened." },
  403: { title: "Access denied", message: "You don't have permission to see this page." },
  404: { title: "Page not found", message: "The page you're looking for may have moved, or the link may be wrong." },
  405: { title: "Action not allowed", message: "This page doesn't support what you tried to do." },
  406: { title: "Format not available", message: "This page isn't available in a format your browser accepts." },
  407: { title: "Proxy login required", message: "Your network's proxy needs you to log in first." },
  408: { title: "Request timed out", message: "That took too long to reach us. Check your connection and try again." },
  409: { title: "Conflict", message: "This clashes with a change that was already made. Refresh and try again." },
  410: { title: "Page removed", message: "This page has been permanently removed." },
  411: { title: "Length required", message: "That request was missing its length, so we couldn't accept it." },
  412: { title: "Condition not met", message: "The page has changed since you opened it. Refresh and try again." },
  413: { title: "Too large", message: "What you sent is too large. Try a smaller file." },
  414: { title: "Link too long", message: "This link is too long for us to open." },
  415: { title: "File type not supported", message: "We can't accept that type of file. Try a different format." },
  416: { title: "Range not available", message: "We couldn't send that part of the file." },
  417: { title: "Expectation failed", message: "We couldn't meet what that request asked for." },
  418: { title: "I'm a teapot", message: "This server only makes tea, not coffee." },
  421: { title: "Wrong server", message: "That request reached the wrong server." },
  422: { title: "Check your details", message: "Some of what you entered isn't valid. Check it and try again." },
  423: { title: "Locked", message: "This item is locked and can't be changed right now." },
  424: { title: "Earlier step failed", message: "This couldn't finish because an earlier step failed." },
  425: { title: "Too early", message: "That request arrived too early. Try again in a moment." },
  426: { title: "Upgrade required", message: "Your browser needs a newer connection method to open this page." },
  428: { title: "Refresh required", message: "Refresh the page to get the latest version, then try again." },
  429: { title: "Too many requests", message: "You've made a lot of requests in a short time. Wait a moment and try again." },
  431: { title: "Request too large", message: "Your browser sent too much data. Clearing this site's cookies may help." },
  451: { title: "Unavailable for legal reasons", message: "This page can't be shown for legal reasons." },

  500: { title: "Something went wrong", message: "That's an error on our side, not yours. Try again in a moment." },
  501: { title: "Not available yet", message: "We don't support this feature yet." },
  502: { title: "Bad gateway", message: "One of our servers sent a bad response. Try again in a moment." },
  503: { title: "Service unavailable", message: "We're down for maintenance or very busy. Try again shortly." },
  504: { title: "Gateway timeout", message: "One of our servers took too long to respond. Try again in a moment." },
  505: { title: "HTTP version not supported", message: "Your browser used a connection type we don't support. Try updating it." },
  506: { title: "Server setup error", message: "Our server is set up incorrectly. We're sorry about that." },
  507: { title: "Out of storage", message: "Our server has run out of storage space. Try again later." },
  508: { title: "Server loop detected", message: "Our server got stuck in a loop handling that request." },
  510: { title: "Request not supported", message: "That request needs extra details we didn't receive." },
  511: { title: "Network login required", message: "Log in to your network, such as Wi-Fi, to continue." }
};

// Codes worth repeating, because the cause is usually temporary
const RETRYABLE = [408, 425, 429];

export const canRetry = (code) => code >= 500 || RETRYABLE.includes(code);
