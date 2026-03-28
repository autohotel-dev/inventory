import json

try:
    with open(r"C:\Users\hackm\.gemini\antigravity\brain\336b0aaf-a230-4a17-abc2-8e187581f760\conversation.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    for i, msg in enumerate(data):
        if msg.get("role") == "tool" and "response" in msg and "output" in msg["response"]:
            out = msg["response"]["output"]
            if isinstance(out, str):
                if "export function useGranularPayment(" in out:
                    with open(f"c:/desarrollos/luxor/old_hook_{i}.txt", "w", encoding="utf-8") as outf:
                        outf.write(out)
                if "export function GranularPaymentModal(" in out:
                    with open(f"c:/desarrollos/luxor/old_modal_{i}.txt", "w", encoding="utf-8") as outf:
                        outf.write(out)
                        
    print("Done extracting files.")
except Exception as e:
    print(f"Error: {e}")
