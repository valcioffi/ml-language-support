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

class TypeMask extends Type {
    constructor (element, mask) {
        super(element.type);
        this.element = element;
        this.touple = element.touple;
        this.list = element.list;
        this.mask = mask;
    }

    toString() {
        return this.element.toString().replace(new RegExp("'+" + 'a', 'g'), (match) => {
            const index = match.length - 1; // get the number of ' characters
            if (Array.isArray(this.mask)) {
                return this.mask[index]; // replace with the corresponding element from mask
            } else {
                return this.mask; // replace with mask itself if it's not an array
            }
        });
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

function parseType(value) {
    if (value.startsWith('[') && value.endsWith(']')) {
        const innerValue = value.slice(1, -1);
        const regex = /,(?![^\(\[]*[\]\)])/g; // regex to match commas not inside brackets or strings
        const firstElement = innerValue.split(regex)[0] || innerValue;
        return new List(parseType(firstElement));
    } else if (value.startsWith('(') && value.endsWith(')')) {
        const innerValue = value.slice(1, -1);
        const regex = /,(?![^\(\[]*[\]\)])/g; // regex to match commas not inside brackets or strings
        const slices = innerValue.split(regex);
        const parsedSlices = slices.map(slice => parseType(slice.trim()));
        return new Touple(parsedSlices);
    }
     else if (/^#\S+$/.test(value)) {
        return new Type('char');
    } else if (/^".+"$/.test(value)) {
        return new Type('string');
    } else if (/^\d+$/.test(value)) {
        return new Type('int');
    } else if (/^\d+\.\d+$/.test(value)) {
        return new Type('real');
    } else if (/(true|false|=|<|>|andalso|orelse)/.test(value)) {
        return new Type('bool');
    } else if (/::/.test(value)) {
        const listElement = value.split('::')[0].trim();
        return new List([parseType(listElement)]);
    } else if (identifiers[value] ? true : false) {
        return new identifiers[value];
    } else if (value.split(/[^a-zA-Z0-9_.]/)[0] != value){
        const splitted = value.split(/[^a-zA-Z0-9_.#\[\]"]/);
        return parseType(splitted[1]) ? new TypeMask(parseType(splitted[0]), parseType(splitted[1])) : (parseType(splitted[0] ?? new Type())); //TODO: allow touples, edit identifiers structure to understand how to extract a from input
    }
    return new Type();
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
    ["use", "use $1;", ["path to module"]],
    ["exception", "exception $1;", ["name"]],
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
    
     
    //User-defined variables and functions
    let userProvider_triggerCharacters=[];
    let userProvider = {
        provideCompletionItems(document, position, token, context) {
            let text = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
            let variablePattern = /val\s+(\w+)\s*(=\s*(.*?)\s*;)?/g;
            let functionPattern = /fun\s+(\w+)\s*\((.*?)\)\s*=\s*(.*?)\s*;/gs;
            let match;
            let completionItems = [];
            while ((match = variablePattern.exec(text)) !== null) {
                let variableName = match[1];
                let variableValue = match[3] || '';
                let completionItem = new vscode.CompletionItem(this.name, vscode.CompletionItemKind.Variable);
                completionItem.label = variableName;
                completionItem.documentation = "User-defined variable";
                completionItem.detail = parseDetail(new Identifier(variableName, new parseType(variableValue), null, "", "variable", variableValue));
                completionItems.push(completionItem);
            }
            while ((match = functionPattern.exec(text)) !== null) {
                const functionName = match[1];
                const functionParams = match[2];
                const functionValue = match[3];
 
                let functionType = new Type();
                functionValue.split('|').forEach(pattern => {
                    functionType=parseDetail(pattern.substring(pattern.indexOf('=')+1)[1]??pattern??'')??new Type();
                })


                let completionItem = new vscode.CompletionItem(this.name, vscode.CompletionItemKind.Function);
                completionItem.label = functionName;
                completionItem.documentation = "User-defined function";
                completionItem.detail =parseDetail(new Identifier(functionName, parseType(functionParams), parseType(functionValue), "", "function", functionValue))
                completionItems.push(completionItem);
            }
            return completionItems;
        }
    };
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('ml', userProvider, ...userProvider_triggerCharacters));

}

exports.activate = activate;