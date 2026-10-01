import { describe, expect, it } from "vitest";
import { isSafeArg, parseCreatedFiles, pickMainFile, summarizeError, validateName } from "../schematics";

describe("validateName", () => {
  it.each(["user-list", "shared/user-list", "@scope/thing", "a_b.c"])("accepts %s", (name) => {
    expect(validateName(name)).toBeUndefined();
  });
  it.each(["", "  ", "foo; rm -rf ~", "a b", "$(whoami)", "a&&b", "'x'", "../up", "a/../b", ".hidden"])(
    "rejects %j",
    (name) => {
      expect(validateName(name)).toBeTypeOf("string");
    },
  );
});

describe("isSafeArg", () => {
  it("accepts typical flags", () => {
    for (const a of ["--style=scss", "--skip-tests", "--path=src/app", "-d"]) expect(isSafeArg(a)).toBe(true);
  });
  it("rejects shell metacharacters", () => {
    for (const a of ["a b", "x;y", "`id`", "$HOME", "a|b", ""]) expect(isSafeArg(a)).toBe(false);
  });
});

describe("CLI output helpers", () => {
  const output = [
    "CREATE src/app/foo/foo.component.html (20 bytes)",
    "CREATE src/app/foo/foo.component.spec.ts (500 bytes)\r",
    "CREATE src/app/foo/foo.component.ts (300 bytes)",
    "UPDATE src/app/app.module.ts (400 bytes)",
  ].join("\n");

  it("parses CREATE lines only", () => {
    expect(parseCreatedFiles(output)).toEqual([
      "src/app/foo/foo.component.html",
      "src/app/foo/foo.component.spec.ts",
      "src/app/foo/foo.component.ts",
    ]);
  });
  it("handles paths with spaces", () => {
    expect(parseCreatedFiles("CREATE my app/src/a.ts (1 bytes)")).toEqual(["my app/src/a.ts"]);
  });
  it("picks the first non-spec .ts file", () => {
    expect(pickMainFile(parseCreatedFiles(output))).toBe("src/app/foo/foo.component.ts");
  });
  it("falls back to the first file, or undefined", () => {
    expect(pickMainFile(["a.html", "b.css"])).toBe("a.html");
    expect(pickMainFile([])).toBeUndefined();
  });
  it("summarizes errors", () => {
    expect(summarizeError("noise\nError: Specified module does not exist.\nmore")).toBe(
      "Error: Specified module does not exist.",
    );
    expect(summarizeError("just a line\n")).toBe("just a line");
    expect(summarizeError("")).toBe("Unknown error.");
  });
});
