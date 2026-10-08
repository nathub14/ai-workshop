# AI Launch Lab

A light wrapper around the OpenAI API for the kids' AI workshop. One chat screen with three switches:

- **🔎 Web search**: answers with clickable sources (Mission 2 Research)
- **🎨 Make pictures**: image generation in the chat; pictures are saved and downloadable (Mission 3)
- **🛠 Builder**: the AI replies with a whole web page, shown live on the right with version history (v1, v2…), a full-screen button and **Share (link + QR)**. Use it for the landing page, survey and slides (Missions 4, 5, 7)

Plain chat covers inventing, data analysis and the stress test. Every reply has an **X-ray** link showing exactly what was sent to the AI (hidden instructions + whole conversation). Use it for the "real request" part of the lesson.

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

Open http://localhost:3000. Without a Blob store, saved pictures and shared pages go in a `.data` folder.

## 2. Put it on Vercel (10 min)

1. Push this folder to a GitHub repo and import it at vercel.com/new.
2. In the project's **Settings → Environment Variables** add `OPENAI_API_KEY`, `OPENAI_MODEL`, `ACCESS_CODE`, `ADMIN_PASSWORD`.
3. **Storage → Create → Blob**, choose **Private**, connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` for you. (If you pick Public instead, also add `BLOB_ACCESS=public`.)
4. Redeploy. Open the site, type the access code, and test every switch.

## 3. OpenAI account checks (do these first)

- **Spending limit**: set a monthly budget on the project in the OpenAI dashboard.
- **Image generation** may need your organisation to be **verified** in the OpenAI dashboard (Settings → Organization). If pictures fail with a verification error, that's why; verification can take a while, so start it now.
- **Model**: `OPENAI_MODEL` must support the `web_search` and `image_generation` tools in the Responses API. If a request fails with a model error, change it to a current model from OpenAI's model list.

## On the day

- Write the site link and the access code on the whiteboard.
- **/admin** (your `ADMIN_PASSWORD`): edit the hidden prompts. The front prompt goes in front of every message; the builder prompt is added when 🛠 is on. Changes apply within about a minute.
- **Professor Know-It-All demo**: on your own laptop open the site with `?demo=1` at the end of the link. Every answer then slips in one wrong fact. Open it without `?demo=1` to go back to normal.
- Shared pages live at `/p/<id>` and keep working after the day, so parents can keep them.
