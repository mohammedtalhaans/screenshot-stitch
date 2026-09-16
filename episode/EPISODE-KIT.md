# Screenshot Stitch — episode kit

**Format:** concise narrated build-and-demo, approximately 2:45, plus a 50-second social cut. Timings are edit targets; rehearse at your natural pace. Capture real interactions first, then record the voiceover to fit. No development timeline, benchmark, or detection accuracy is implied.

**Episode idea:** Three screenshots become one readable image, with a deliberate privacy review before saving. The build story is the product decision: make stitching, finding sensitive details, and correcting the result one continuous workflow.

**Audience assumption:** people who enjoy useful small web apps and practical build demos. Tone: conversational, specific, curious. One CTA: try the demo and suggest the next improvement.

## Before recording: make one complete demo

1. Open the built app in a clean browser tab. Click **Try the demo**. It generates three synthetic screenshots and **starts processing immediately**. Click **Cancel** on the processing screen to return to the populated preparation screen; this is an intentional stop to show the inputs and settings. The files are `conversation-01.png` through `conversation-03.png`, with fictional contact, order, and payment details. If processing finishes before you cancel, start a fresh demo and cancel earlier.
2. Capture the three thumbnails for the episode opening. Keep **Everything**, **Remove repeated headers**, and **Full detail · up to 1200px wide**, with screenshots in 01 → 02 → 03 order. Click **Stitch & protect** to restart and wait for review. The synthetic images use the same real stitching and scanning engines as uploaded images. Normal visitors can simply let **Try the demo** run directly to review.
3. Check seams **before editing masks**. Open **Adjust seams** (a low-confidence result can instead label this button “1 seam to review” or similar). Note the automatic overlap. Move the slider briefly to show the join changing, click **Use automatic values**, then **Rebuild & scan**. This is a control demonstration; do not present an intentionally wrong slider setting as an actual bug. Rebuilding reruns detection and resets mask edits.
4. In the inspector, select an **Email address** suggestion if present, then inspect its coverage. Open **Needs review**; the list can legitimately be empty. Do not promise an exact suggestion count. Scroll the whole image, including the header, address, order details, receipt, and QR code.
5. Choose **Add a manual redaction**, then draw a **Solid** box over the receipt’s `$ 128.00` total to demonstrate hiding an extra detail by choice. Resize it, press **Undo**, then **Redo**. If that total is already covered, use another visible nonessential detail. Review any uncovered sensitive details and add solid masks where needed.
6. Click **Compare**, slide across the image, and return to editing. Use synthetic images for all original/reveal footage. Click **Review & export**, name the file `screenshot-stitch-demo`, and leave full resolution selected.
7. Scroll the **Final image** preview from top to bottom. Only then tick the review checkbox and click **Save clean image**. Open the actual downloaded PNG and inspect it. Keep this file for the episode’s opening and final reveal.

## Main episode: approximately 2:45

| Time | Spoken script | Picture / action |
| --- | --- | --- |
| 0:00–0:10 | “Three screenshots, one conversation—and a surprising amount of personal information. I’m building Screenshot Stitch to turn those pieces into one image I can review before sharing.” | Cold open on three demo thumbnails, then the finished downloaded PNG. Overlay: **3 screenshots → 1 image**. Use an actual output capture. |
| 0:10–0:26 | “The useful part is bringing the whole job together: join the screenshots, find details that might need covering, and let me make the final call. Here’s the working app.” | Landing page; brief cursor move toward **Try the demo**. Show the name once. |
| 0:26–0:43 | “These demo details are fictional. The demo starts automatically; I’m cancelling so we can inspect the three inputs first. I’ll keep the Everything preset, then restart with Stitch and protect.” | **Try the demo** → processing → **Cancel** → populated preparation screen. Show filenames, **SYNTHETIC DEMO · REAL PROCESSING**, settings, then **Stitch & protect**. |
| 0:43–1:01 | “It compares overlapping pixels to join vertical screenshots, then uses English text recognition to suggest details to cover. That processing runs in the browser; the screenshots aren’t sent to an image-processing service.” | Brief processing footage, then review. Optional small diagram overlay: **Pixels → stitch → local scan → review**. Keep the diagram secondary to the app. |
| 1:01–1:19 | “I can inspect the joins and adjust the overlap myself. Watch the preview change. I’ll restore the automatic value here. Rebuilding resets mask edits, so seams are the first thing I check.” | Open seam dialog; move slider; **Use automatic values** → **Rebuild & scan**. Cut the second wait. |
| 1:19–1:39 | “Now the privacy pass. These are suggestions, so I inspect the boxes and the rest of the image. I can move or resize a mask, and add one myself. Let’s cover this receipt total as well.” | Select an actual suggestion; show **Needs review** briefly, then manual Solid mask over the total. Resize it slowly enough to follow. |
| 1:39–1:54 | “Undo and redo make adjustments easy. I’m using solid masks for sensitive details. The app also has blur and pixelation, but those can leave information readable.” | Undo, redo; hold on **Solid**. Avoid cycling through effects on the finished export. |
| 1:54–2:12 | “The comparison view lets me check what changed without losing the conversation. I still need to inspect everything—especially names, photos, addresses, and codes that automatic detection might miss.” | Toggle **Compare**, drag the divider, and scroll through the synthetic image. Return to masked view. |
| 2:12–2:32 | “Then I review the entire final image, confirm that check, and save a flattened PNG. The masks are painted into the exported image, and it doesn’t carry editable redaction layers or the source metadata.” | **Review & export**; enter filename; scroll preview; tick confirmation; **Save clean image**. Cut to the opened download. |
| 2:32–2:45 | “That’s Screenshot Stitch: a small tool for sharing the full conversation more carefully. Try the demo from the link, and tell me what you’d want it to handle next.” | Hold the actual output, then landing page. End card: **Try the demo · Link in description**. Use this CTA after the live link is verified. |

The narration is about 300 words, with room for action pauses. If the cut runs long, shorten the seam segment before cutting the final review.

## Social cut: approximately 50 seconds

Record or crop for a vertical frame. Show one readable area of the interface at a time; avoid shrinking the entire desktop editor into a phone-sized frame. Use the preparation footage captured after **Cancel** in the setup above. The short opens on already loaded inputs, so it does not imply that **Try the demo** lands on the settings screen.

| Time | Spoken script | Picture / text |
| --- | --- | --- |
| 0:00–0:05 | “Three screenshots. One conversation. Too many personal details.” | Three demo thumbnails snap to the actual final PNG. Text: **Keep the conversation.** |
| 0:05–0:14 | “I’m building Screenshot Stitch. Add overlapping screenshots, put them in order, and click Stitch and protect.” | Demo prepare screen and run button. Text: **Stitch the pieces.** |
| 0:14–0:23 | “It joins the images and suggests sensitive details to cover, using local processing in your browser.” | Processing cut to real review result. Text: **Review the suggestions.** |
| 0:23–0:35 | “I can adjust the seams, resize a mask, or draw another one. Detection can miss things, so the final check is still mine.” | Fast seam preview, then one clear mask resize and manual Solid box. Text: **You make the final call.** |
| 0:35–0:44 | “After reviewing the whole image, I save a flattened PNG. The conversation stays readable.” | Preview scroll → checkbox → save → real PNG. Text: **Save one clean image.** |
| 0:44–0:50 | “Try the demo from the link. What should I add next?” | Landing page with CTA. |

## Capture and edit checklist

- Capture a clean 1920 × 1080 desktop master, with the browser large enough that the inspector labels are legible. Record the vertical insert shots separately or crop around each active control.
- Use the synthetic demo throughout. Turn off desktop notifications and close unrelated tabs. Keep the browser’s downloads list and other personal files out of frame.
- Do one rehearsal before the narration take. Capture the real wait on the first run; if it is shortened in the edit, use **Processing shortened**. Browser caching and device speed can change timing.
- Record these eight reusable shots: landing, three inputs, processing, seam dialog, mask edit, comparison, export review, opened downloaded PNG. Leave two seconds still before and after each action.
- For the build beat, optionally capture `src/lib/stitch-algorithm.ts`, `src/lib/ocr.ts`, and `src/lib/render.ts` for one second each. Describe architecture, not a fictional account of how long development took or what failed.
- Use short captions with at most two lines, high contrast, and margins that keep text away from the controls. Put emphasis on **review**, **solid masks**, and **one image**.
- Voice first; keep any music quiet and use only audio you have rights to. Leave the final image on screen long enough to judge the result.
- Before publication, run the shipped verification steps and test **Try the demo → save PNG** on the deployed GitHub Pages URL. Replace the link placeholders below. Do not claim a measured speed, perfect stitching, guaranteed privacy, universal face detection, or offline readiness.

## Packaging

**Recommended title:** I Built a Screenshot Stitcher With Privacy Controls

**Alternatives:**

- Three Screenshots, One Image: Building Screenshot Stitch
- Stitch, Review, Share: A Small Web App for Long Screenshots

**Thumbnail brief:** Actual app output on a dark background. Three small input strips on the left; one large readable stitched image on the right, with visible solid masks. One short line: **3 SHOTS. 1 STORY.** Keep the screenshot content synthetic. The output should be the focal point; avoid invented badges or performance numbers.

**Video description — replace links after deployment:**

> I’m building Screenshot Stitch, a browser app that combines overlapping screenshots and helps you review sensitive details before sharing.
>
> This episode walks through the synthetic demo: stitching, seam controls, editable privacy masks, comparison, and PNG export. Screenshot processing runs locally in your browser. Automatic detection needs a careful human review; use solid masks for sensitive details.
>
> Try the app: [LIVE_URL]
> Source code: [REPOSITORY_URL]
>
> What should it handle next?

**Pinned comment:**

> Try the built-in demo here: [LIVE_URL]. What’s the most annoying part of preparing a screenshot to share? Detection is a starting point—review the whole image before exporting.

**Short-video post copy:**

> Three screenshots → one readable image. I’m building Screenshot Stitch with local scanning, editable masks, and a final review before export. Try the demo: [LIVE_URL]. What would you add?

**If the site is not live at recording time:** end with “That’s the working demo. What would you want it to handle next?” Add the live CTA during the final edit once deployment is verified.


## Updated UI for 1.2.0

The app now uses a light editing workspace. On phones, switch between Details and Mask controls beneath the canvas. Selected-mask controls open automatically. Precise values commit on blur or Enter; Escape cancels a field edit. Fit width is the default, Fit image shows the complete screenshot, and the percentage button shows actual size. Back to screenshots and Resume review retain the current edit; a canceled rebuild also retains it. Export offers Fit width and Actual size preview controls. The main episode story and spoken script remain valid.
