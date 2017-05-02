---
title: ファイラー内骨格でMキーのアサインを変更する
---

## ほかのキーと同じように再アサインできない'M'キー

ファイラーとして、2画面キーボードファイラーの[内骨格](https://sites.google.com/site/craftware/cfiler)を愛用しているのですが、Mキーの再アサインが ver. 2.45 現在、ほかのキーと同じように再アサインしようとしても、できない状態になっています(私の環境では、非選択状態だとデフォルト動作のディレクトリ作成が、ファイル選択状態だと変更した動作になりました)。

```python
# config.py (正常動作しない)
def configure(window):
    window.keymap["M"]=window_commandJumpList
```

## Mキーの再アサインをする

結論を先に書くと、以下のようなコードを追記すれば通常の再アサインが可能になります

```python 
# config.py
import ckit
from ckit.ckit_const import *

def configure(window):
    original_delitem = ckit.Keymap.__delitem__
    def monkeypatch_delitem(self, expression):
        if isinstance(expression, str):
            original_delitem(self, expression)
        else:
            del self.table[expression]
    ckit.Keymap.__delitem__=monkeypatch_delitem

    del window.keymap[ckit.KeyEvent(ord('M'),0,extra=0)]
    del window.keymap[ckit.KeyEvent(ord('M'),0,extra=1)]
    del window.keymap[ckit.KeyEvent(ord('M'),MODKEY_SHIFT,extra=1)] # S-Mも変えたい場合は必要
    
    window.keymap["M"]=window.command_JumpList # 好きなコマンドに差し替え
```

## なぜ? (細かい話)

Mキーは、デフォルトではファイル未選択状態ではディレクトリ作成、選択状態では移動と、状態により異なる操作が割り当てられています。この割り当てのためにほかのキーと異なるキーアサインをされているようです。具体的には、`window.keymap`に対してMキー以外は文字列をキーに、ファンクションを値に設定しているのですが、Mキーだけは`ckit.KeyEvent`オブジェクトをキーとしています。そのため、config.pyにて文字列"M"をキーに設定を上書きしようとしてもデフォルト設定が残ってしまい、予期した動作にならないようです。そのため、事前に`KeyEvent`のがキーとなっているエントリを削除しているのが、`del window.keymap` の部分です。

しかし`ckit.Keymap`の実装で、`del`時の同値性比較に入力を文字列と仮定して必ず`str`から`KeyEvent`オブジェクトへの変換をしてしまっています。なので、`del`をそのまま実行すると、以下のようなエラーがでてしまいます。

```
ERROR : 設定ファイルの実行中にエラーが発生しました.
Traceback (most recent call last):
  File "../ckit\ckit_userconfig.py", line 42, in callConfigFunc
  File "config.py", line 65, in configure
  File "../ckit\ckit_key.py", line 439, in \_\_delitem\_\_
  File "../ckit\ckit_key.py", line 338, in fromString
AttributeError: 'KeyEvent' object has no attribute 'upper'
```

これを回避するため、`ckit.Keymap.__delitem__`メソッドにモンキーパッチを当てて、`str`以外の場合はわたってきた型のまま、delを行うようにしています。