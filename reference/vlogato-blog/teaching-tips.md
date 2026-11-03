# Teaching Tips

Source: https://web.archive.org/web/20220520105804id_/http://vlogato.com/teaching-tips/
Snapshot: 2022-05-20

---

On this page I am going to explain how I teach in the most effective way.

Find the Makro below which I talk about in the Video:

Sub HighlightErrorsAndGrammar() ' ' HighlightErrors Macro ' Selection.WholeStory Selection.ClearFormatting ActiveDocument.AttachedTemplate.LanguageID = wdGerman ActiveDocument.AttachedTemplate.NoProofing = False Selection.LanguageID = wdGerman Selection.NoProofing = False Application.CheckLanguage = True Dim range As range Dim currentDoc As Document Set currentDoc = ActiveDocument For Each range In currentDoc.SpellingErrors range.Font.Color = wdColorBlue range.Font.Bold = True Next For Each range In currentDoc.GrammaticalErrors range.Font.Color = wdColorGreen Next End Sub

---

## Images in the original

(none found in the archived HTML)

## Embedded videos / maps in the original

- https://www.youtube.com/embed/CjhndQEF1XY?feature=oembed&start&end&wmode=opaque&loop=0&controls=1&mute=0&rel=0&modestbranding=0
