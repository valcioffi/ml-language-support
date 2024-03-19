const vscode = require('vscode');

//Setup ML type and identifiers parsing

class Type {
    basic_types = [
        'int',
        'real',
        'bool',
        'string',
        'char',
        'list',
        'touple'
    ]

    constructor (type='\'a'){
        if (type.includes('\'') || this.basic_types.includes(type))
            this.type = type;
        else
            this.type = '\'a';
    }

    toString() {
        return this.type;
    }
}

class List extends Type {
    constructor (list_type=new Type()) {
        super('list');
        this.list=list_type;
    }

    toString() {
        return `${this.list.toString()} list`;
    }
}

class Touple extends Type {
    constructor (touple_type=[new Type()]) {
        super('touple');
        this.touple = touple_type.map(t => t??new Type());
    }

    toString() {
        return `(${this.touple.map(t => t.toString()).join(' * ')})`;
    }
}

let identifiers = {};

class Identifier {
    identifier_types = [
        'function',
        'operator',
        'variable',
        'constant'
    ]

    constructor(name, type_in, type_out, description, type_id, value) {
        this.name = name;
        this.type_in = type_in;
        this.type_out = type_out;
        this.description = description;
        this.type_id = this.identifier_types.includes(type_id) ? type_id : 'snippet';
        this.value = value;
        if (!identifiers[this.name]) {
            identifiers[this.name] = {};
        }
        
        identifiers[this.name] = this.type_out || this.type_in;
    }
}

//Define built-in identifiers and keywords

const sys_identifiers = [
    new Identifier ('hd', new List(), new Type(), "Returns the first element of a list.", 'function'),
    new Identifier ('tl', new List(), new List(), "Returns a list without its first element.", 'function'),
    new Identifier ('explode', new Type('string'), new List('char'), "Converts a string into a list of characters.", 'function'),
    new Identifier ('implode', new List('char'), new Type('string'), "Converts a list of characters into a string.", 'function'),
    new Identifier ('floor', new Type('real'), new Type('int'), "Rounds a real number down to the nearest integer.", 'function'),
    new Identifier ('ceil', new Type('real'), new Type('int'), "Rounds a real number up to the nearest integer.", 'function'),
    new Identifier ('trunc', new Type('real'), new Type('int'), "Truncates a real number to an integer.", 'function'),
    new Identifier ('round', new Type('real'), new Type('int'), "Rounds a real number to the nearest integer.", 'function'),
    new Identifier ('abs', new Type('real'), new Type('int'), "Returns the absolute value of a real number.", 'function'),
    new Identifier ('ord', new Type('char'), new Type('int'), "Returns the ASCII value of a character.", 'function'),
    new Identifier ('chr', new Type('int'), new Type('char'), "Returns the character with the given ASCII value.", 'function'),
    new Identifier ('str', new Type('char'), new Type('string'), "Converts a character into a string.", 'function'),
    new Identifier ('real', new Type('int'), new Type('real'), "Converts an integer into a real number.", 'function'),
    new Identifier ('not', new Type('bool'), new Type('bool'), "Negates a boolean value.", 'function'),
    new Identifier ('+', new Touple([new Type('int'), new Type('int')]), new Type('int'), "Returns the sum of two integer numbers.", 'operator'),
    new Identifier ('+', new Touple([new Type('real'), new Type('real')]), new Type('real'), "Returns the sum of two real numbers.", 'operator'),
    new Identifier ('-', new Touple([new Type('int'), new Type('int')]), new Type('int'), "Returns the difference of two integer numbers.", 'operator'),
    new Identifier ('-', new Touple([new Type('real'), new Type('real')]), new Type('real'), "Returns the difference of two real numbers.", 'operator'),
    new Identifier ('*', new Touple([new Type('int'), new Type('int')]), new Type('int'), "Returns the product of two integer numbers.", 'operator'),
    new Identifier ('*', new Touple([new Type('real'), new Type('real')]), new Type('real'), "Returns the product of two real numbers.", 'operator'),
    new Identifier ('div', new Touple([new Type('int'), new Type('int')]), new Type('int'), "Returns the quotient of two integer numbers.", 'operator'),
    new Identifier ('/', new Touple([new Type('real'), new Type('real')]), new Type('real'), "Returns the quotient of two real numbers.", 'operator'),
    new Identifier ('mod', new Touple([new Type('int'), new Type('int')]), new Type('int'), "Returns the remainder of two integer numbers.", 'operator'),
    new Identifier ('^', new Touple([new Type('string'), new Type('string')]), new Type('string'), "Concatenates two strings.", 'operator'),
    new Identifier ('@', new Touple([new List(), new List()]), new List(), "Concatenates two lists.", 'operator'),
    new Identifier ('::', new Touple([new Type(), new List()]), new List(), "Adds an element to the beginning of a list.", 'operator'),
    new Identifier ('nil', new List(), null, "The empty list.", 'constant', '[]')
]

const keywords = [
    ["fun", "fun $1 ($2) = $3;", ["name", "arguments", "function"]],
    ["val", "val $1 = $2;", ["name", "value"]],
    ["use", "use $1;", ["path to module"]],
    ["exception", "exception $1;", ["name"]],
    ["if", "if $1 then $2 else $3", ["condition", "function", "function"]],
    ["then", "then $1 else $2", ["function", "function"]],
    ["else", "else $1", ["function"]],
    ["raise", "raise $1", ["exception"]],
    ["and"], ["andalso"], ["orelse"], ["or"], ["as"]
]

// Auto-completion and on-hover documentation
function activate(context) {

    //ML Identifiers
    function parseDetail(identifier){
        let ret;
        switch (identifier.type_id) {
            case 'function':
                ret = identifier.type_in && identifier.type_out ? `${identifier.name} : ${identifier.type_in} -> ${identifier.type_out}` : `${identifier.name} : function`;
                break;
            case 'variable':
                ret = identifier.value ? `val ${identifier.name} = ${identifier.value} : ${identifier.type_in}` : identifier.type_in ? `val ${identifier.name} : ${identifier.type_in}` : `val ${identifier.name}`;
                break;
            case 'constant':
                ret = identifier.value ? `${identifier.name} = ${identifier.value} : ${identifier.type_in}` : identifier.type_in ? `${identifier.name} : ${identifier.type_in}` : `${identifier.name}`;
                break;
            case 'operator':
                ret = identifier.type_in && identifier.type_out ? `${identifier.type_in.touple[0]} ${identifier.name} ${identifier.type_in.touple[1]} : ${identifier.type_out}` : `${identifier.name}`;
                break;
            case 'snippet':
                break;
        }

        return ret;
    }

    sys_identifiers.forEach(identifier => {
        let provider = {
            provideCompletionItems(document, position){
                const completionKind = {
                    'function' : vscode.CompletionItemKind.Function,
                    'operator' : vscode.CompletionItemKind.Operator,
                    'variable' : vscode.CompletionItemKind.Variable,
                    'constant' : vscode.CompletionItemKind.Constant,
                    'snippet' : vscode.CompletionItemKind.Snippet
                }
                let completionItem = new vscode.CompletionItem(identifier.name, completionKind[identifier.type_id]);
                completionItem.label = identifier.name;
                completionItem.documentation = identifier.description;
                completionItem.detail = parseDetail(identifier);
        
                return [completionItem];
        
            }        
        };
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider('ml', provider, identifier.name[0]));
    });

    //ML Keywords
    keywords.forEach(keyword => {
        let provider = {
            provideCompletionItems(document, position) {
                let completionItem = new vscode.CompletionItem(this.name, vscode.CompletionItemKind.Keyword);
                completionItem.label = keyword[0];
                completionItem.insertText = new vscode.SnippetString(keyword[1]);
                completionItem.detail = keyword[1];
                
                keyword[2].forEach((param, index) => {
                    completionItem.detail = completionItem.detail.replace(new RegExp(`\\$${index+1}`, 'g'), "<"+param+">");
                });                
                
                return [completionItem];
            }
        }
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider('ml', provider, keyword[0][0]));
     });
     
    //Other ML-specific code snippets
    let snippet_provider = {
        provideCompletionItems(document, position) {
            const lineText = document.lineAt(position.line).text;
            let keywordLine = position.line;
            let keyword = lineText.split('fun').pop().split(/\s+/)[1] || '';
            if (!keyword) {
                for (let i = position.line - 1; i >= 0; i--) {
                    const previousLineText = document.lineAt(i).text;
                    keyword = previousLineText.split('fun').pop().split(/\s+/)[1] || '';
                    if (keyword) {
                        keywordLine = i;
                        break;
                    }
                }
            }
            
            let afterKeyword = '';
            for (let i = keywordLine; i <= position.line; i++) {
                const lineText = document.lineAt(i).text;
                afterKeyword += lineText.substring(lineText.indexOf(keyword) + keyword.length);
            }
                    
            if (afterKeyword.includes('=') && !afterKeyword.includes(';')) {
                const item = new vscode.CompletionItem(`| ${keyword} () =`, vscode.CompletionItemKind.Snippet);
                item.insertText = new vscode.SnippetString(`   ${keyword} ($1) = $2`);
                item.detail = `| ${keyword} (<params>) = <code>;`
                item.documentation = new vscode.MarkdownString("Adds a pattern to a function.");
                return [item];
            }
        
            return [];
        }
    }
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('ml', snippet_provider, '|'));
}

exports.activate = activate;