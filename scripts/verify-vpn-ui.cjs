// Production picker and pinned Woods React renderer; all VPN callbacks are local fixtures.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  http = require("node:http"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  scratch = path.resolve(
    process.env.WOODS_QA_TEMP || process.env.TEMP || os.tmpdir(),
    "woods-vpn-ui",
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
import { React } from ${modulePath("runtime/react.ts")};
import { g } from ${modulePath("runtime/vendor/react-foundation.js")};
import { VpnPicker } from ${modulePath("runtime/vpn/VpnPicker.tsx")};
const profiles=[
 {id:'ras:Office',name:'Office VPN',ready:true,on:true},
 {id:'app:warp',name:'Cloudflare WARP',ready:true,on:false},
 {id:'app:custom',name:'Мой личный VPN с очень длинным названием для узкого окна',ready:true,on:null,lastRequestedOn:true},
 {id:'app:happ',name:'Happ',ready:true,on:null},
 {id:'app:proton',name:'Proton VPN',ready:false,on:null,launchPath:'fixture://proton'},
 {id:'ras:Long',name:'Очень длинное название VPN-подключения '.repeat(5),ready:true,on:false},
 {id:'app:unavailable',name:'Unavailable client',ready:false,on:null}
];
window.actions=[]; window.closes=0;
function Fixture(){
 const [state,setState]=React.useState({language:'ru',busy:false,profiles,visible:true});
 window.fixture=update=>setState(value=>({...value,...update}));
 return state.visible ? <VpnPicker profiles={state.profiles} busy={state.busy} language={state.language}
 onClose={()=>{window.closes++;}} onPick={(profile,on)=>window.actions.push({id:profile.id,on})}
 onOpen={path=>window.actions.push({open:path})}/> : null;
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
      '<html data-theme="dark"><head><link rel="stylesheet" href="/runtime.css"><link rel="stylesheet" href="/entry.css"></head><body style="background:var(--color-island);color:var(--color-ink)"><button id="opener">Fixture opener</button><div id="root" style="position:absolute;inset:0"></div><script type="module" src="/entry.js"></script></body></html>',
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 300, height: 360 } }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator("[data-vpn-choice]").waitFor();
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.hasAttribute("data-vpn-choice"),
    ),
    true,
    "picker receives focus for Escape",
  );
  const snapshots = [];
  for (const width of [300, 480])
    for (const theme of ["dark", "light"])
      for (const language of ["ru", "en"]) {
        await page.setViewportSize({ width, height: 360 });
        await page.evaluate(
          ({ theme, language }) => {
            document.documentElement.dataset.theme = theme;
            window.fixture({ language });
          },
          { theme, language },
        );
        await page
          .getByRole("dialog", {
            name: language === "ru" ? "Подключения VPN" : "VPN connections",
          })
          .waitFor();
        const overflow = await page.evaluate(() =>
          [
            ...document.querySelectorAll(
              "[data-vpn-choice], [data-vpn-choice] *",
            ),
          ]
            .filter((el) => el.getBoundingClientRect().width > 0)
            .some((el) => {
              const r = el.getBoundingClientRect();
              return (
                r.left < -0.5 ||
                r.right > innerWidth + 0.5 ||
                (el.scrollWidth > el.clientWidth + 1 &&
                  !el.matches(".wi-vpn-pick > span"))
              );
            }),
        );
        assert.equal(
          overflow,
          false,
          `${width}/${theme}/${language}: no horizontal overflow`,
        );
        assert.equal(
          await page
            .locator('[data-vpn-pick="ras:Office"]')
            .getAttribute("data-on"),
          "true",
        );
        assert.equal(
          await page
            .locator('[data-vpn-unknown="app:custom"] [data-vpn-command]')
            .count(),
          2,
        );
        assert.equal(
          await page
            .locator('[data-vpn-unknown="app:happ"] [data-vpn-command]')
            .count(),
          2,
        );
        const file = `${width}-${theme}-${language}.png`;
        await page.screenshot({ path: path.join(scratch, file) });
        snapshots.push(file);
      }
  await page.locator('[data-vpn-pick="ras:Office"]').click();
  await page.locator('[data-vpn-pick="app:warp"]').click();
  await page
    .locator(
      '[data-vpn-command-profile="app:custom"][data-vpn-command="connect"]',
    )
    .click();
  await page
    .locator(
      '[data-vpn-command-profile="app:happ"][data-vpn-command="disconnect"]',
    )
    .click();
  await page.locator('[data-vpn-pick="app:proton"]').click();
  assert.deepEqual(await page.evaluate(() => window.actions), [
    { id: "ras:Office", on: false },
    { id: "app:warp", on: true },
    { id: "app:custom", on: true },
    { id: "app:happ", on: false },
    { open: "fixture://proton" },
  ]);
  assert.equal(
    await page.evaluate(() => window.closes),
    5,
    "one close and one callback for each action",
  );
  assert.equal(
    await page.locator('[data-vpn-pick="app:unavailable"]').isDisabled(),
    true,
  );
  await page.evaluate(() => window.fixture({ busy: true }));
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-vpn-pick], [data-vpn-command]")].every(
      (el) => el.disabled,
    ),
  );
  await page.locator("[data-vpn-choice]").focus();
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.closes), 6);
  await page.evaluate(() => window.fixture({ busy: false, profiles: [] }));
  await page.getByText("No VPN connections found").waitFor();
  await page.evaluate(() => window.fixture({ visible: false }));
  await page.locator("[data-vpn-choice]").waitFor({ state: "detached" });
  await page.locator("#opener").focus();
  await page.evaluate(() => window.fixture({ visible: true }));
  await page.waitForFunction(() =>
    document.activeElement?.hasAttribute("data-vpn-choice"),
  );
  await page.evaluate(() => window.fixture({ visible: false }));
  await page.waitForFunction(() => document.activeElement?.id === "opener");
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(scratch, "report.json"),
    JSON.stringify(
      {
        pass: true,
        pinnedRenderer: true,
        sizes: [300, 480],
        languages: ["ru", "en"],
        themes: ["dark", "light"],
        actions: 5,
        unknownStateCommands: true,
        busy: true,
        escape: true,
        focusRestoration: true,
        overflow: false,
        snapshots,
      },
      null,
      2,
    ),
  );
  console.log(
    `VPN UI passed: pinned renderer, RU/EN, both themes and widths, explicit unknown-state commands, selection, busy, Escape and focus restoration. Artifacts: ${scratch}`,
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
