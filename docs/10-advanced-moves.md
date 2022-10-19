# Advanced moves

## Navigate

Navigate command requires an array of numbers as input. This numbers will represent right click (positive), left click (negative) or both
click (zero). For left and right clicks, you can specify how many times you wish to click changing the value. For example, if I want to
click 3 times right, then two times both clicks, and then 4 times left, my array would be `[3, 0, 0, -4]`.

Then, we have several functions implementing this idea, and also some helpers to automatize it and avoid passing the whole array of clicks

### Navigate

This function navigates using the movement array defined and takes snapshots in the road. We have 5 parameters in this function:

- `path: string`
  - It's going to save, if needed, the snapshots in `<path>/snapshots-tmp`.
- `testcaseName: string`
  - Directory where, if needed, the screenshots will be saved (`<path>/snapshots-tmp/<testcaseName>`).
- `clickSchedule: number[]`
  - Number array that represents clicks on device.
- `waitForScreenUpdate? = true`
  - Set this to false if you know beforehand that the screens won't change between clicks.
- `takeSnapshots? = true`
  - Set this to false only for navigation (when you don't need the snapshots).
- `startImgIndex? = 0`
  - To concatenate several navigation workflow, you can set the start image index in order to avoid overwriting.

Let's go with an example:

```typescript
await sim.navigate('.', 'my-first-test', [2, 0, -1, 0, 3]) // we are using the defualt for the other params
```

In this case, we are saving snapshots for every click in the movement array in `./snapshots-tmp/my-first-test`.

### Navigate and compare snapshots

This method has two parts. First one is just a regular `navigate` and, when finished, it compares the new snapshots (found in
`<path>/snapshots-tmp`) with a reference version that you would have saved in `<path>/snapshots`.

It takes the sames params as the method before:

With an example (the available params are the same as the previous method!):

```typescript
await sim.navigateAndCompareSnapshots('.', 'my-first-test', [2, 0, -1, 0, 3]) // we are using the defualt for the other params
```

### Navigate until text

In this method, Zemu is going to click right in every screen until it reaches the target `<text>`, and then is going to double click and end
there the workflow. It's useful for signing process in which we have a variable number of screens before reaching `APPROVE` or `REJECT`.

We have 7 avaliable params:

- `path: string`
  - It's going to save, if needed, the snapshots in `<path>/snapshots-tmp`.
- `testcaseName: string`
  - Directory where, if needed, the screenshots will be saved (`<path>/snapshots-tmp/<testcaseName>`).
- `text: string`
  - Target text before double clicking
- `waitForScreenUpdate? = true`
  - Set this to false if you know beforehand that the screens won't change between clicks.
- `takeSnapshots? = true`
  - Set this to false only for navigation (when you don't need the snapshots).
- `startImgIndex? = 0`
  - To concatenate several navigation workflow, you can set the start image index in order to avoid overwriting.
- `timeout? = 5000`
  - Time between clicks before timeout.

With an example:

```typescript
await sim.navigateUntilText('.', 'my-first-test', 'REJECT') // we are using the defualt for the other params
```

## Navigate and compare

For each method of navigating, we have a version to also compare snapshots with a previous version of them. It's useful to check that
nothing changed and the app have the expected result.

After navigating, it's going to compare every snapshot taken. As before, snapshots taken by the method are going to be saved in
`<path>/snapshots-tmp`, and is going to compare that with snapshots found in `<path>/snapshots`.

Every method takes the same params than the analogous in navigating ones. Let's go directly with examples.

### Navigate and compare snapshots

This method navigates using `navigate` method, and then compares the snapshots.

```typescript
await sim.navigateAndCompareSnapshots('.', 'my-first-test', [2, 0, -1, 0, 3]) // we are using the defualt for the other params
```

### Navigate and compare until text

This method navigates using `navigateUntilText` method, and then compares the snapshots.

```typescript
await sim.navigateAndCompareUntilText('.', 'my-first-test', 'REJECT') // we are using the defualt for the other params
```

There's also a helper that works the same as `navigateAndCompareUntilText`, but using always the `APPROVE` text. It's useful to check a
signing workflow of the app:

```typescript
await sim.compareSnapshotsAndApprove('.', 'my-first-test') // we are using the defualt for the other params
```
