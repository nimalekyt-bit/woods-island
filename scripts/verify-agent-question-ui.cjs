// Production AgentQuestion and Woods' pinned renderer. Replies stay in fixtures.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  scratch = path.resolve(
    process.env.WOODS_QA_TEMP || process.env.TEMP || os.tmpdir(),
    "woods-agent-question-ui",
  );
const esbuild = require(
  require.resolve("esbuild", {
    paths: [path.dirname(require.resolve("vite/package.json"))],
  }),
);
const { chromium } = require("playwright-core");
let browser, server;
(async () => {
  await fs.mkdir(scratch, { recursive: true });
  const modulePath = (file) =>
    JSON.stringify(path.join(root, file).replace(/\\/g, "/"));
  await fs.writeFile(
    path.join(scratch, "entry.tsx"),
    `
import {React} from ${modulePath("runtime/react.ts")};
import {g} from ${modulePath("runtime/vendor/react-foundation.js")};
import {AgentQuestion} from ${modulePath("runtime/components/AgentQuestion.tsx")};
const questions=[{question:'Какой режим?',header:'Режим',multiSelect:false,options:[{label:'Быстро',description:'Начать сейчас'},{label:'Качественно',description:'Всё проверить'}]},{question:'Что добавить?',header:'Выбор',multiSelect:true,options:[{label:'Музыка, текст'},{label:'Буфер'},{label:'Очень длинное название дополнительной возможности',description:'Описание тоже может быть длинным и должно оставаться читаемым без выхода за край окна'}]}];
const ask={id:'first',kind:'question',agent:'claude',until:Date.now()+120000,questions};
window.answers=[];window.steps=[];
function Fixture(){
 const [state,setState]=React.useState({ask,mode:'succeed'});window.fixture=update=>setState(value=>({...value,...update}));window.originalAsk=ask;
 return <AgentQuestion ask={state.ask} terminal={<button data-ask-terminal>Terminal</button>}
 onStep={step=>window.steps.push(step)} onAnswer={async answers=>{window.answers.push(answers);if(state.mode==='delay')return new Promise(resolve=>window.resolveReply=resolve);if(state.mode==='throw')throw new Error('fixture');return state.mode!=='fail';}}/>;
}
g().createRoot(document.getElementById('root')).render(<Fixture/>);`,
  );
  await esbuild.build({
    entryPoints: [path.join(scratch, "entry.tsx")],
    bundle: true,
    outfile: path.join(scratch, "entry.js"),
    format: "esm",
    platform: "browser",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    tsconfigRaw: {
      compilerOptions: {
        jsx: "react",
        jsxFactory: "React.createElement",
        jsxFragmentFactory: "React.Fragment",
      },
    },
    logLevel: "silent",
  });
  server = http.createServer(async (req, res) => {
    const files = {
      "/entry.js": [path.join(scratch, "entry.js"), "application/javascript"],
      "/entry.css": [path.join(scratch, "entry.css"), "text/css"],
      "/runtime.css": [
        path.join(root, "runtime/styles/runtime.css"),
        "text/css",
      ],
    };
    if (files[req.url]) {
      const [file, type] = files[req.url];
      res.setHeader("Content-Type", type);
      res.end(await fs.readFile(file));
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<html><head><link rel="stylesheet" href="/runtime.css"><link rel="stylesheet" href="/entry.css"></head><body style="margin:0;background:var(--color-sheet);color:var(--color-ink)"><div id="root" style="position:absolute;inset:0;transform-origin:0 0"></div><script type="module" src="/entry.js"></script></body></html>',
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [],
    snapshots = [];
  for (const language of ["ru", "en"]) {
    const context = await browser.newContext({
        locale: language === "ru" ? "ru-RU" : "en-US",
      }),
      page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('[data-agent-ask="question"]').waitFor();
    await page
      .getByText(language === "ru" ? "Claude спрашивает" : "Claude asks", {
        exact: true,
      })
      .waitFor();
    await page.locator('[data-ask-choice="Быстро"]').click();
    await page.locator("[data-ask-done]").waitFor();
    assert.equal(await page.locator("[data-ask-done]").isDisabled(), true);
    await page.locator('[data-ask-choice="Музыка, текст"]').click();
    await page.locator('[data-ask-choice="Буфер"]').click();
    assert.equal(
      await page
        .locator('[data-ask-choice="Музыка, текст"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    for (const width of [300, 480])
      for (const theme of ["dark", "light"])
        for (const scale of [1, 1.5]) {
          await page.setViewportSize({ width, height: 320 });
          await page.evaluate(
            ({ width, theme, scale }) => {
              document.documentElement.dataset.theme = theme;
              const root = document.getElementById("root");
              root.style.width = width / scale + "px";
              root.style.height = 320 / scale + "px";
              root.style.transform = "scale(" + scale + ")";
            },
            { width, theme, scale },
          );
          const overflow = await page.evaluate(() =>
            [
              ...document.querySelectorAll(
                "[data-agent-ask], [data-agent-ask] *",
              ),
            ]
              .filter(
                (el) =>
                  el.getBoundingClientRect().width > 0 &&
                  !el.parentElement?.closest(".truncate"),
              )
              .some((el) => {
                const r = el.getBoundingClientRect();
                return (
                  r.left < -0.5 ||
                  r.right > innerWidth + 0.5 ||
                  (el.scrollWidth > el.clientWidth + 1 &&
                    !el.matches(".truncate,.line-clamp-2"))
                );
              }),
          );
          if (overflow) {
            console.log(
              await page.evaluate(() =>
                [
                  ...document.querySelectorAll(
                    "[data-agent-ask], [data-agent-ask] *",
                  ),
                ]
                  .map((el) => ({
                    class: el.className,
                    text: el.textContent?.slice(0, 60),
                    width: el.clientWidth,
                    scroll: el.scrollWidth,
                    right: el.getBoundingClientRect().right,
                  }))
                  .filter(
                    (el) =>
                      el.scroll > el.width + 1 || el.right > innerWidth + 0.5,
                  ),
              ),
            );
            await page.screenshot({ path: path.join(scratch, "overflow.png") });
          }
          assert.equal(
            overflow,
            false,
            `${language}/${theme}/${width}/${scale}: no horizontal overflow`,
          );
          const file = `${language}-${theme}-${width}-${scale}.png`;
          await page.screenshot({ path: path.join(scratch, file) });
          snapshots.push(file);
        }
    await page.evaluate(() => {
      const root = document.getElementById("root");
      root.style.width = "480px";
      root.style.height = "320px";
      root.style.transform = "none";
      window.fixture({ mode: "delay" });
    });
    await page.locator("[data-ask-done]").click();
    await page.waitForFunction(() => window.answers.length === 1);
    assert.equal(await page.locator("[data-ask-done]").isDisabled(), true);
    assert.equal(
      await page.locator('[data-ask-choice="Буфер"]').isDisabled(),
      true,
    );
    await page.locator("[data-ask-done]").evaluate((button) => button.click());
    assert.equal(await page.evaluate(() => window.answers.length), 1);
    assert.deepEqual(await page.evaluate(() => window.answers[0]), {
      "Какой режим?": "Быстро",
      "Что добавить?": ["Музыка, текст", "Буфер"],
    });
    await page.evaluate(() => window.resolveReply(false));
    await page
      .locator("[role=status]")
      .filter({
        hasText:
          language === "ru" ? "Ответ не отправился" : "Answer was not sent",
      })
      .waitFor();
    await page.evaluate(() => window.fixture({ mode: "succeed" }));
    await page.locator("[data-ask-done]").click();
    assert.equal(await page.evaluate(() => window.answers.length), 2);
    await page.evaluate(() =>
      window.fixture({
        ask: {
          ...window.originalAsk,
          id: "next",
          agent: "codex",
          until: Date.now() + 120000,
        },
      }),
    );
    await page.locator('[data-ask-choice="Быстро"]').waitFor();
    await page
      .getByText(language === "ru" ? "Codex спрашивает" : "Codex asks", {
        exact: true,
      })
      .waitFor();
    assert.deepEqual(await page.evaluate(() => window.steps), [1]);
    await page.evaluate(() =>
      window.fixture({
        ask: { ...window.originalAsk, id: "expired", until: Date.now() - 1 },
      }),
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll("[data-ask-choice]")].every(
        (button) => button.disabled,
      ),
    );
    await page
      .locator('[data-ask-choice="Быстро"]')
      .evaluate((button) => button.click());
    assert.equal(await page.evaluate(() => window.answers.length), 2);
    await page.evaluate(() =>
      window.fixture({
        ask: { ...window.originalAsk, id: "invalid", questions: [] },
      }),
    );
    await page
      .getByText(
        language === "ru"
          ? "Этот вопрос лучше открыть в терминале"
          : "Open this question in the terminal",
      )
      .waitFor();
    assert.equal(await page.locator("[data-ask-terminal]").count(), 1);
    await context.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(scratch, "report.json"),
    JSON.stringify(
      {
        pass: true,
        pinnedRenderer: true,
        languages: ["ru", "en"],
        themes: ["dark", "light"],
        widths: [300, 480],
        scales: [1, 1.5],
        single: true,
        multi: true,
        commaLabels: true,
        busy: true,
        retry: true,
        expiry: true,
        askReset: true,
        invalidFallback: true,
        horizontalOverflow: false,
        snapshots,
      },
      null,
      2,
    ),
  );
  console.log(
    "Agent question UI passed: pinned renderer, RU/EN, themes, narrow/large/scaled layout, single/multi, pending/retry/expiry, provider title and terminal fallback. Artifacts: " +
      scratch,
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  });
