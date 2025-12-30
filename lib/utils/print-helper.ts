export function printHTML(htmlContent: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        try {
            // Create a hidden iframe
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.width = '0px';
            iframe.style.height = '0px';
            iframe.style.border = 'none';
            iframe.style.visibility = 'hidden'; // Or 'hidden', but sometimes 'visibility: hidden' is safer for rendering

            document.body.appendChild(iframe);

            const doc = iframe.contentWindow?.document;
            if (!doc) {
                document.body.removeChild(iframe);
                reject(new Error("Could not access iframe document"));
                return;
            }

            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Wait for content to load (images, etc)
            iframe.onload = () => {
                try {
                    // Focus and print
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();

                    // We can resolve immediately after triggering print, 
                    // or set a timeout to remove the iframe. 
                    // Removing it too early might cancel print in some browsers.
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                        resolve(true);
                    }, 1000);
                } catch (err) {
                    console.error("Print execution error:", err);
                    // Clean up even on error
                    document.body.removeChild(iframe);
                    reject(err);
                }
            };

        } catch (error) {
            console.error("Print setup error:", error);
            reject(error);
        }
    });
}
