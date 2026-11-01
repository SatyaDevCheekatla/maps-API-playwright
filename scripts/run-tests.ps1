Param(
    [string]$Suite = "full"
)

$nodeBin = "C:\Users\6saty\AppData\Local\OpenAI\Codex\runtimes\cua_node\1fb7137c46617d50\bin"
$shims = "C:\Users\6saty\AppData\Local\OpenAI\Codex\runtimes\cua_node\1fb7137c46617d50\bin\node_modules\corepack\shims"
$env:PATH = "$nodeBin;$shims;$env:PATH"

switch ($Suite.ToLower()) {
    "smoke" { npm.cmd run test:smoke }
    "regression" { npm.cmd run test:regression }
    "negative" { npm.cmd run test:negative }
    "contract" { npm.cmd run test:contract }
    Default { npm.cmd test }
}
