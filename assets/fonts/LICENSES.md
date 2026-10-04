# Font sources and licenses

The bundled Latin-subset WOFF2 files are served by Google Fonts and distributed under the SIL Open Font License, version 1.1. Exact family licenses are included beside this file. Original glyph data is unchanged. Four families use six files, totaling 160,056 bytes.

- **cinzel**: Copyright 2020 The Cinzel Project Authors (https://github.com/NDISCOVER/Cinzel). License source: https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/OFL.txt; local license: `cinzel-OFL.txt`.
- **cinzeldecorative**: Copyright (c) 2012 Natanael Gama (info@ndiscovered.com), with Reserved Font Name 'Cinzel'. License source: https://raw.githubusercontent.com/google/fonts/main/ofl/cinzeldecorative/OFL.txt; local license: `cinzeldecorative-OFL.txt`.
- **cormorantgaramond**: Copyright 2015 the Cormorant Project Authors (github.com/CatharsisFonts/Cormorant). License source: https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt; local license: `cormorantgaramond-OFL.txt`.
- **plusjakartasans**: Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans). License source: https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt; local license: `plusjakartasans-OFL.txt`.

## Download manifest

Downloaded 2026-10-02 from the official Google Fonts CSS API. CSS request used variable weight ranges for Cinzel (400–900), Cormorant Garamond (300–700, roman and italic), Plus Jakarta Sans (200–800), and static Cinzel Decorative (400 and 700). Latin subset only; the original unicode-range declarations are retained in fonts.css. Dancing Script was omitted because its only CSS consumer is `.eyebrow`, and no `.eyebrow` element exists in the current page.

- Cinzel, normal, 400 900: https://fonts.gstatic.com/s/cinzel/v26/8vIJ7ww63mVu7gt79mT7.woff2
- Cinzel Decorative, normal, 400: https://fonts.gstatic.com/s/cinzeldecorative/v19/daaCSScvJGqLYhG8nNt8KPPswUAPni7TTMw.woff2
- Cinzel Decorative, normal, 700: https://fonts.gstatic.com/s/cinzeldecorative/v19/daaHSScvJGqLYhG8nNt8KPPswUAPniZoadlESTE.woff2
- Cormorant Garamond, italic, 300 700: https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtImSo.woff2
- Cormorant Garamond, normal, 300 700: https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtK.woff2
- Plus Jakarta Sans, normal, 200 800: https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2

Validation: all six files decode with fontTools, contain valid name tables, and expose the expected variable or static weight tables. The Cormorant variable fonts use the internal base name “Cormorant Garamond Light”; the official Google Fonts API CSS intentionally registers these as “Cormorant Garamond,” preserved in local fonts.css.
