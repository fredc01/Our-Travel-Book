# Our Travel Book (Google Sheets version)

A scrapbook website for our trips. Everything is added and edited **on the website itself**. A Google Sheet quietly stores the data behind it, and you never have to open it.

## How we use it
1. Open the site and press **Sign in** (top right). Type our password.
2. Now you can:
   - **+ Add a memory**: title, place, date, mood, story and up to 6 photos. Every field is required. The first photo is the cover; tap ★ on another one to make it the cover.
   - Open any memory to **Edit** or **Delete** it.
   - **⚙️ Our details & next trip**: names, "together since" date, next trip place and date.
   - Tick, add or remove **bucket list** items, and add or remove **dream places** (faded stamps).
3. Visitors who aren't signed in can only look.

## Part 1: Set up the Google Sheet (about 10 minutes, once)
1. Go to https://sheets.new to make a blank Google Sheet. Name it "Our Travel Book".
2. In the sheet open **Extensions > Apps Script**. Delete the sample code, paste in everything from `apps-script/Code.gs`, and change `change-me` on the `PASSWORD` line to the password you both will use. Press **Save**.
3. At the top, pick **setup** in the function drop-down (not doGet) and press **Run**. Google asks for permission: choose your account, then **Advanced > Go to project (unsafe) > Allow**. This warning is normal for your own scripts. When the log says "Execution completed", the sheet has its four tabs filled with sample content, and a Drive folder called "Our Travel Book photos" exists.
4. Press **Deploy > New deployment**. Click the gear next to "Select type", choose **Web app**, then set **Execute as: Me** and **Who has access: Anyone**. Press **Deploy** and copy the **Web app URL** (it starts with `https://script.google.com/macros/s/` and ends with `/exec`).
5. Open `js/config.js` in this folder and paste that URL between the quotes after `SCRIPT_URL:`. Save the file.

## Part 2: Put the website on GitHub (about 10 minutes, once)

**Before you start, two rules**
- Your real password must **never** be written in the `Code.gs` file inside this folder. On a free GitHub account the repository is public, so anyone could read it. Only the copy you pasted into Apps Script holds the real password. Leave `change-me` in the file here, or simply don't upload the `apps-script` folder.
- `index.html` must end up at the **top level** of the repository, not inside another folder. If it is nested, the site shows a 404.

### Option A: in the browser (no software needed)
1. Sign in at https://github.com, press **+ > New repository**. Give it a name such as `our-travel-book`, choose **Public**, and press **Create repository**.
2. On the new empty repository page press **uploading an existing file**.
3. Open this folder on your computer, select **everything inside it** (`index.html`, `css`, `js`, `images`, `README.md`, and optionally `apps-script`) and drag it all into the GitHub page. Don't drag the outer folder itself. Wait until every file has finished uploading.
4. In the box under "Commit changes" type a message like `First version` and press **Commit changes**.
5. Check the file list: you should see `index.html`, `css`, `js` and `images` right at the top level.

### Option B: with Git (if you have Git installed)
Create the empty repository on GitHub first (step 1 above, and don't tick "Add a README"). Then in a terminal, inside this folder:
```
git init
git add .
git commit -m "First version"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/our-travel-book.git
git push -u origin main
```
When asked to sign in, use your GitHub username and a **personal access token** as the password (GitHub > Settings > Developer settings > Personal access tokens), or sign in through GitHub Desktop instead.

### Turn the website on
1. In the repository open **Settings > Pages**.
2. Under **Build and deployment** set **Source** to **Deploy from a branch**, **Branch** to `main`, folder `/ (root)`, and press **Save**.
3. Wait one or two minutes and refresh that page. A box appears saying "Your site is live at ..." with your address, which looks like `https://YOUR-NAME.github.io/our-travel-book/`.
4. Open it, press **Sign in**, type the password, and add your first memory.

### Changing something later
- **In the browser**: open the file in the repository, press the pencil icon, edit, then **Commit changes**. The site updates after a minute or two.
- **With Git**: change the file, then `git add .`, `git commit -m "What I changed"` and `git push`.
- You never need to do this for memories, photos or settings. Those are saved from the website itself.

## If something goes wrong
- **404 page**: `index.html` is probably inside a folder. Check that it is at the top level of the repository, and that Pages is set to `main` and `/ (root)`.
- **"The site isn't connected to our Google Sheet yet"**: `js/config.js` still has an empty `SCRIPT_URL`. Edit it on GitHub and commit.
- **"We couldn't open our book"**: the web app was not deployed with **Who has access: Anyone**, or the URL was copied wrongly. Check step 4 of Part 1.
- **The site looks unchanged after a commit**: wait a couple of minutes, then hard refresh (Ctrl+F5, or Cmd+Shift+R on a Mac).
- **"Wrong password" on sign in**: type the exact password from `Code.gs` in Apps Script. If you changed it later, redeploy (see below).

## Good to know
- **Changing Code.gs later** (for example the password): save, then **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**. The URL stays the same. Signed-in devices will be asked to sign in again.
- **Privacy**: the sheet itself stays private to you. But anyone with the website link can see the memories (the page has to be able to read them), and photos are viewable by anyone who has the photo's link.
- **Password**: it is one shared password with no lockout, so pick a long one that isn't used anywhere else.
- **Speed**: saving can take a second or two, because Google's scripts are not instant.
- **You can still peek at the sheet**, but leave the **ID** column alone and avoid renaming the tabs or header rows.
- Photos are stored in your Google Drive folder "Our Travel Book photos". A memory with several photos keeps them all in one cell of the Photo column, separated by `|`. Deleting a memory (or removing a photo from it) moves the photo to the Drive trash.
- Preview on your computer: run `python -m http.server` in this folder and open http://localhost:8000.

## Folders
```
index.html                    the page
css/style.css                 the look
js/app.js                     page behaviour
js/db.js                      talks to the Google Sheet script
js/config.js                  YOUR web app URL
js/effects.js                 hearts and confetti
apps-script/Code.gs           paste into the Google Sheet (Part 1, step 2)
images/                       the three sample photos (new photos go to Drive)
```
