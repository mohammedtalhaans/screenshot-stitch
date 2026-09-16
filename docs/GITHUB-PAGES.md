# Publish Screenshot Stitch on GitHub Pages

The app is a static site. GitHub serves the page, JavaScript, and bundled English OCR assets; stitching and image processing run in the visitor's browser.

## Recommended: deploy the source with GitHub Actions

1. Create a GitHub repository with a `main` branch. Put the **contents of the `screenshot-stitch` source folder** at the repository root, so `package.json` is directly inside the repository. Include hidden files, especially `.github/`, `.node-version`, and `.gitignore`. Commit `package-lock.json`; the workflow uses `npm ci`.
2. Open **Settings → Pages → Build and deployment → Source**, and choose **GitHub Actions**. The included workflow is already configured, so skip GitHub's suggested templates. [GitHub publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
3. Push the source to `main`. If that first push ran before Pages was enabled, open **Actions → Verify and deploy Screenshot Stitch → Run workflow**, selecting `main`.
4. Wait for verification and deployment to finish. The deployment supplies the site URL. An ordinary project repository uses `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

The workflow installs Node 22, audits runtime dependencies, checks types, runs unit tests, builds the site, and runs Chromium and WebKit browser tests before deployment. It uploads `dist/` and deploys through the `github-pages` environment. Pull requests run verification without publishing. Its Pages actions and permissions follow [GitHub's custom-workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Do not upload only the source ZIP as a repository file: extract and commit its contents. `node_modules/`, test reports, and `dist/` are generated and do not need to be committed for this workflow.

## Alternative: publish the compiled site

For a build-free deployment, extract the contents of the compiled site ZIP into a dedicated publishing branch. `index.html` must sit at that branch's root alongside `assets/`, `ocr/`, and the other bundled files. Include `.nojekyll`. Set Pages to **Deploy from a branch**, choose that branch and **/(root)**, then save. These are the supported branch publishing controls in [GitHub's instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Use one publishing approach. The source workflow automatically points **View source** to your GitHub repository; the compiled bundle offers its included source download.

## Check the live site

- Open the deployed URL with its trailing slash. Try the synthetic demo, inspect the stitch, edit a mask, and save a PNG.
- Check on a phone as well as desktop. Clipboard and native sharing depend on browser support; PNG download is the common export path.
- If OCR fails, confirm the entire `ocr/` folder was published. Engine files and `eng.traineddata.gz` must return files, not a 404 page.

The build uses relative asset paths, so a repository rename or a different project prefix does not require a Vite base-path edit. There is no client-side route fallback to configure. Test a production build through `npm run preview`; opening `index.html` directly as a local file does not provide a valid worker environment.
