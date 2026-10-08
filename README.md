# AI Launch Lab

A light wrapper around the OpenAI API for the kids' AI workshop. One chat screen with four tools (one at a time):

- **Chat**: inventing, data analysis, stress test
- **Web search**: answers with clickable sources (Mission 2 Research)
- **Image**: make and edit pictures; students download the ones they like (Mission 3)
- **Build**: a full landing page, survey or slide deck, shown live on the right (desktop or phone view) with version history, full screen and **Share** (link + QR). Use it for Missions 4, 5, 7

Build mode also does quizzes, live polls, waitlists, order forms, launch countdowns, mini games and brand boards; the empty chat shows one-click starters for each. Surveys and forms on built pages **really save answers** from everyone who opens the shared link. The **Responses** tab next to the preview shows them live as bar charts, with a CSV download. Pages show live results and counters too, but the public counts leave out names, emails and other personal fields.

Students attach saved pictures with the **+** button (or paste them). The AI sees them and puts them in the pages it builds. The build prompt never invents facts, prices or stats: anything the student hasn't given shows up as a highlighted placeholder, and the AI asks for it. Every reply has an **X-ray** link showing exactly what was sent to the AI (hidden instructions + whole conversation). Use it for the "real request" part of the lesson.

Kids' chats are saved in their own browser, so a refresh loses nothing. Nobody signs up; they type one access code.

## 1. Run it on your laptop (5 min)

```
npm install
copy .env.example .env.local
```

Fill in `.env.local` (at minimum `OPENAI_API_KEY`), then:

```
npm run dev
```

Open http://localhost:3000. Check **/admin**: the status panel shows whether storage and the AI key are working. Without a Blob store, saved pictures and shared pages go in a `.data` folder.

## 2. Put it on Vercel (10 min)

1. Push this folder to a GitHub repo and import it at vercel.com/new.
2. In the project's **Settings → Environment Variables** add `OPENAI_API_KEY`, `OPENAI_MODEL`, `ACCESS_CODE`, `ADMIN_PASSWORD`.
3. **Storage → Create → Blob**, choose **Private**, connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` for you. (If you pick Public instead, also add `BLOB_ACCESS=public`.)
4. Redeploy. Open **/admin** and check Storage says **Working**. If Share or pictures fail, this panel tells you why.
5. Open the site, type the access code, and test every tool.

## 3. OpenAI account checks (do these first)

- **Spending limit**: set a monthly budget on the project in the OpenAI dashboard.
- **Image generation** may need your organisation to be **verified** in the OpenAI dashboard (Settings → Organization). If pictures fail with a verification error, that's why; verification can take a while, so start it now.
- **Model**: `OPENAI_MODEL` must support the `web_search` and `image_generation` tools in the Responses API. If a request fails with a model error, change it to a current model from OpenAI's model list. For better-looking builds, set `OPENAI_BUILDER_MODEL` to OpenAI's strongest current model; only Build mode uses it.

## On the day

- Write the site link and the access code on the whiteboard.
- **/admin** (your `ADMIN_PASSWORD`): edit the hidden prompts. The front prompt goes in front of every message; the build prompt is added in Build mode. The status panel at the top shows whether storage and the AI key are working. Changes apply within about a minute.
- **Professor Know-It-All demo**: on your own laptop open the site with `?demo=1` at the end of the link. Every answer then slips in one wrong fact. Open it without `?demo=1` to go back to normal.
- Shared pages live at `/p/<id>` and keep working after the day, so parents can keep them.
