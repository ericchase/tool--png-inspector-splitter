# Example

```
bun ./src/split.ts ./sample.png
```

# Code Notes

I wrote a LOT of this with the help of ChatGPT. It's so much easier learning new things with ChatGPT instead of manually google searching and parsing large documents to find the relevant information.

I gathered most of the ideas from amazing resources, like https://www.nayuki.io/page/png-file-chunk-inspector, https://www.w3.org/TR/2003/REC-PNG-20031110/#11Chunks, https://www.w3.org/TR/PNG-Chunks.html, and others.

The goal was to split up a png file into smaller parts. If you know a bit about the png spec, you might naively think this is an easy task. It seemed that way for us at first. The more I asked ChatGPT about the different parts of a png file, I began to realize that processing pngs for even simple tasks require a great deal of precise code.

For serious use cases, I would probably look into a vetted png library for whichever language is needed, instead.
